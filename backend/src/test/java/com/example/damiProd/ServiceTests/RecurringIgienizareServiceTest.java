package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.SubscriptionType;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.service.RecurringIgienizareService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Task generation for recurring sanitation plans — the source of the
 * {@code recurring_plan_id} parent on {@link Task}, and the half of the
 * scheduler that actually writes rows.
 *
 * The tricky parts, all covered below:
 *   - the 90-day LOOKAHEAD_DAYS window for indefinite plans is relative to
 *     TODAY, while a fixed-end plan generates to its own endDate;
 *   - {@code lastGeneratedDate} makes a second run a near no-op, which is what
 *     stops the nightly cron from re-creating everything every night;
 *   - the client's display name is resolved by downcasting Client, so a bare
 *     Client (see ClientJsonSubTypesTest) falls back to "Client necunoscut".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecurringIgienizareServiceTest {

    @Mock private RecurringIgienizareRepository recurringRepo;
    @Mock private OrderRepository orderRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private RouteRepository routeRepository;

    private RecurringIgienizareService service;

    private Company acme;
    private Route route;
    private Subscription monthly;

    @BeforeEach
    void setUp() {
        service = new RecurringIgienizareService(recurringRepo, orderRepository, taskRepository,
                clientRepository, subscriptionRepository, routeRepository);

        acme = new Company("office@acme.ro", "0311", "Bd. 20", "Acme SRL", "RO1", "Maria");
        acme.setId(1L);

        route = new Route();
        route.setId(10L);
        route.setName("Ruta Nord");

        monthly = new Subscription();
        monthly.setId(20L);
        monthly.setName("Plan Lunar");
        monthly.setType(SubscriptionType.RECURRING);

        when(recurringRepo.save(any(RecurringIgienizare.class))).thenAnswer(inv -> inv.getArgument(0));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private RecurringIgienizare plan(LocalDate start, LocalDate end, boolean indefinite, int frequencyDays) {
        RecurringIgienizare plan = new RecurringIgienizare();
        plan.setId(100L);
        plan.setClient(acme);
        plan.setSubscription(monthly);
        plan.setRoute(route);
        plan.setActive(true);
        plan.setStartDate(start);
        plan.setEndDate(end);
        plan.setIsIndefinite(indefinite);
        plan.setFrequencyDays(frequencyDays);
        plan.setSanitationLocationAddress("Str. Igienă 3");
        plan.setSanitationLocationCoordinates("44.41,26.06");
        plan.setContact("Ion Pop");
        plan.setDetails("cod poartă 1234");
        return plan;
    }

    private List<Task> generatedTasks() {
        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }

    // -----------------------------------------------------------------------
    // Guard clauses
    // -----------------------------------------------------------------------

    @Test
    void generateTasksForPlan_withoutARoute_writesNothing() {
        RecurringIgienizare noRoute = plan(LocalDate.now().minusDays(1), null, true, 7);
        noRoute.setRoute(null);

        service.generateTasksForPlan(noRoute);

        verify(taskRepository, never()).save(any());
        verify(recurringRepo, never()).save(any());
    }

    @Test
    void generateTasksForPlan_withoutAStartDate_writesNothing() {
        RecurringIgienizare noStart = plan(null, null, true, 7);

        service.generateTasksForPlan(noStart);

        verify(taskRepository, never()).save(any());
    }

    @Test
    void generateTasksForPlan_whenDeactivated_writesNothing() {
        RecurringIgienizare inactive = plan(LocalDate.now().minusDays(1), null, true, 7);
        inactive.setActive(false);

        service.generateTasksForPlan(inactive);

        verify(taskRepository, never()).save(any());
    }

    // -----------------------------------------------------------------------
    // Indefinite plans — the 90-day rolling window
    // -----------------------------------------------------------------------

    @Test
    void indefinitePlan_generatesExactlyUpToTheNinetyDayLookahead() {
        LocalDate start = LocalDate.now();
        service.generateTasksForPlan(plan(start, null, true, 30));

        List<Task> tasks = generatedTasks();
        LocalDate horizon = LocalDate.now().plusDays(90);

        assertThat(tasks).isNotEmpty();
        assertThat(tasks).allSatisfy(task ->
                assertThat(task.getScheduledDate()).isBetween(start, horizon));
        // start, +30, +60, +90 — the boundary date is inclusive (`!date.isAfter`).
        assertThat(tasks).extracting(Task::getScheduledDate)
                .containsExactly(start, start.plusDays(30), start.plusDays(60), start.plusDays(90));
    }

    @Test
    void indefinitePlan_spacesTasksByFrequencyDays() {
        LocalDate start = LocalDate.now();
        service.generateTasksForPlan(plan(start, null, true, 14));

        List<LocalDate> dates = generatedTasks().stream().map(Task::getScheduledDate).toList();

        for (int i = 1; i < dates.size(); i++) {
            assertThat(ChronoUnit.DAYS.between(dates.get(i - 1), dates.get(i))).isEqualTo(14L);
        }
    }

    /**
     * A plan with {@code isIndefinite = false} but no endDate ALSO falls into
     * the 90-day branch — the condition is
     * {@code isIndefinite || endDate == null}. Worth pinning: a UI that forgets
     * to send endDate silently gets an indefinite plan.
     */
    @Test
    void planWithNoEndDate_isTreatedAsIndefiniteEvenWhenTheFlagIsFalse() {
        LocalDate start = LocalDate.now();
        service.generateTasksForPlan(plan(start, null, false, 45));

        assertThat(generatedTasks()).extracting(Task::getScheduledDate)
                .containsExactly(start, start.plusDays(45), start.plusDays(90));
    }

    // -----------------------------------------------------------------------
    // Fixed-end plans
    // -----------------------------------------------------------------------

    @Test
    void fixedEndPlan_stopsAtItsOwnEndDate() {
        LocalDate start = LocalDate.of(2026, 1, 5);
        service.generateTasksForPlan(plan(start, LocalDate.of(2026, 2, 5), false, 14));

        assertThat(generatedTasks()).extracting(Task::getScheduledDate)
                .containsExactly(start, start.plusDays(14), start.plusDays(28));
    }

    @Test
    void fixedEndPlan_generatesHistoricalDatesToo() {
        // Generation is NOT clipped to "today": a plan created late still gets
        // its past occurrences, which is why a fresh plan can appear on routes
        // that have already been driven.
        LocalDate start = LocalDate.now().minusDays(60);
        service.generateTasksForPlan(plan(start, LocalDate.now(), false, 30));

        assertThat(generatedTasks()).extracting(Task::getScheduledDate)
                .contains(start, start.plusDays(30));
    }

    // -----------------------------------------------------------------------
    // Idempotency — what keeps the nightly cron cheap
    // -----------------------------------------------------------------------

    @Test
    void datesThatAlreadyHaveATaskAreSkipped() {
        LocalDate start = LocalDate.now();
        when(taskRepository.existsByRecurringPlan_IdAndScheduledDate(eq(100L), any(LocalDate.class)))
                .thenAnswer(inv -> inv.getArgument(1, LocalDate.class).equals(start.plusDays(30)));

        service.generateTasksForPlan(plan(start, null, true, 30));

        assertThat(generatedTasks()).extracting(Task::getScheduledDate)
                .doesNotContain(start.plusDays(30))
                .contains(start, start.plusDays(60));
    }

    @Test
    void lastGeneratedDate_isAdvancedToTheFinalGeneratedDate() {
        LocalDate start = LocalDate.now();
        RecurringIgienizare plan = plan(start, null, true, 30);

        service.generateTasksForPlan(plan);

        assertThat(plan.getLastGeneratedDate()).isEqualTo(start.plusDays(90));
        verify(recurringRepo).save(plan);
    }

    @Test
    void aSecondRunResumesAfterLastGeneratedDateInsteadOfReplayingTheWholePlan() {
        LocalDate start = LocalDate.now().minusDays(60);
        RecurringIgienizare plan = plan(start, null, true, 30);
        plan.setLastGeneratedDate(LocalDate.now());

        service.generateTasksForPlan(plan);

        assertThat(generatedTasks()).extracting(Task::getScheduledDate)
                .allSatisfy(date -> assertThat(date).isAfter(LocalDate.now()));
    }

    // -----------------------------------------------------------------------
    // What each generated task actually carries
    // -----------------------------------------------------------------------

    @Test
    void generatedTasksCarryThePlansDispatchDetails() {
        LocalDate start = LocalDate.now();
        RecurringIgienizare plan = plan(start, null, true, 90);

        service.generateTasksForPlan(plan);

        Task task = generatedTasks().get(0);
        assertThat(task.getType()).isEqualTo(TaskType.SANITIZATION);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.NEW);
        assertThat(task.getAddress()).isEqualTo("Str. Igienă 3");
        assertThat(task.getCoordinates()).isEqualTo("44.41,26.06");
        assertThat(task.getClientName()).isEqualTo("Acme SRL");
        assertThat(task.getClientPhone()).isEqualTo("0311");
        assertThat(task.getContactPerson()).isEqualTo("Ion Pop");
        assertThat(task.getInternalNotes()).isEqualTo("cod poartă 1234");
        assertThat(task.getProductName()).isEqualTo("Plan Lunar");
        assertThat(task.getRoute()).isSameAs(route);
        assertThat(task.getRecurringPlan()).isSameAs(plan);
        // Both date fields are set: scheduledDate drives the idempotency check,
        // scheduledTime keeps the task visible to the time-range finders.
        assertThat(task.getScheduledDate()).isEqualTo(start);
        assertThat(task.getScheduledTime()).isEqualTo(start.atStartOfDay());
        // The plan is NOT the order — a generated task has no order_id.
        assertThat(task.getOrder()).isNull();
    }

    @Test
    void individualClients_useFullNameAndUnknownClientsFallBackToRomanianPlaceholder() {
        Individual ion = new Individual("ion@x.ro", "0722", "Str. 4", "Ion Popescu", "19001");
        ion.setId(2L);
        RecurringIgienizare forIndividual = plan(LocalDate.now(), null, true, 90);
        forIndividual.setClient(ion);

        service.generateTasksForPlan(forIndividual);
        assertThat(generatedTasks().get(0).getClientName()).isEqualTo("Ion Popescu");
    }

    @Test
    void aBareClientYieldsTheRomanianUnknownPlaceholder() {
        com.example.damiProd.domain.Client bare = new com.example.damiProd.domain.Client("x@y.ro", "07", "addr");
        bare.setId(3L);
        RecurringIgienizare forBare = plan(LocalDate.now(), null, true, 90);
        forBare.setClient(bare);

        service.generateTasksForPlan(forBare);

        assertThat(generatedTasks().get(0).getClientName()).isEqualTo("Client necunoscut");
    }

    // -----------------------------------------------------------------------
    // create / assignRoute / deactivate
    // -----------------------------------------------------------------------

    @Test
    void create_alsoWritesTheVisibleIgienizareOrderAndBacklinksThePlan() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(acme));
        when(subscriptionRepository.findById(20L)).thenReturn(Optional.of(monthly));

        RecurringIgienizare input = new RecurringIgienizare();
        input.setSubscription(monthly);
        input.setStartDate(LocalDate.of(2026, 1, 5));
        input.setSanitationLocationAddress("Str. Igienă 3");
        input.setContact("Ion Pop");

        service.create(1L, input);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        Order order = captor.getValue();

        assertThat(order).isInstanceOf(IgienizareOrder.class);
        IgienizareOrder igi = (IgienizareOrder) order;
        assertThat(igi.getOrderType()).isEqualTo("Igienizari");
        assertThat(igi.getClient()).isSameAs(acme);
        assertThat(igi.getSubscription()).isSameAs(monthly);
        assertThat(igi.getSanitationDate()).isEqualTo("2026-01-05");
        assertThat(igi.getRecurringPlan()).isSameAs(input);
    }

    @Test
    void create_defaultsFrequencyToThirtyDaysAndForcesActive() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(acme));

        RecurringIgienizare input = new RecurringIgienizare();
        input.setFrequencyDays(null);
        input.setActive(false);
        input.setStartDate(LocalDate.of(2026, 1, 5));

        RecurringIgienizare saved = service.create(1L, input);

        assertThat(saved.getFrequencyDays()).isEqualTo(30);
        assertThat(saved.getActive()).isTrue();
    }

    @Test
    void create_withoutARoute_generatesNoTasksYet() {
        when(clientRepository.findById(1L)).thenReturn(Optional.of(acme));

        RecurringIgienizare input = new RecurringIgienizare();
        input.setStartDate(LocalDate.of(2026, 1, 5));

        service.create(1L, input);

        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void create_throwsRomanianFreeRuntimeExceptionWhenClientMissing() {
        when(clientRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(99L, new RecurringIgienizare()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Client not found");
    }

    @Test
    void assignRoute_linksTheRouteAndImmediatelyGeneratesTasks() {
        RecurringIgienizare existing = plan(LocalDate.now(), null, true, 90);
        existing.setRoute(null);
        when(recurringRepo.findById(100L)).thenReturn(Optional.of(existing));
        when(routeRepository.findById(10L)).thenReturn(Optional.of(route));

        RecurringIgienizare saved = service.assignRoute(100L, 10L);

        assertThat(saved.getRoute()).isSameAs(route);
        assertThat(generatedTasks()).isNotEmpty();
    }

    @Test
    void assignRoute_throwsWhenTheRouteIsGone() {
        RecurringIgienizare existing = plan(LocalDate.now(), null, true, 90);
        when(recurringRepo.findById(100L)).thenReturn(Optional.of(existing));
        when(routeRepository.findById(77L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignRoute(100L, 77L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Route not found");
    }

    @Test
    void deactivate_clearsPendingTasksButLeavesCompletedOnes() {
        RecurringIgienizare existing = plan(LocalDate.now(), null, true, 30);
        when(recurringRepo.findById(100L)).thenReturn(Optional.of(existing));

        RecurringIgienizare saved = service.deactivate(100L);

        assertThat(saved.getActive()).isFalse();
        // the "non-completed" variant, not the hard delete
        verify(taskRepository).deleteNonCompletedByRecurringPlanId(100L);
        verify(taskRepository, never()).deleteByRecurringPlan_Id(anyLong());
    }

    @Test
    void delete_removesPendingTasksThenThePlan() {
        service.delete(100L);

        verify(taskRepository).deleteNonCompletedByRecurringPlanId(100L);
        verify(recurringRepo).deleteById(100L);
    }
}
