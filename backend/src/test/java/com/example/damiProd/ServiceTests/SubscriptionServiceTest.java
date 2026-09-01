package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.dto.SubscriptionUsageResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.service.SubscriptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Retiring a subscription is refused while anything live still points at it.
 *
 * The rule that matters here — and the reason it differs from the product
 * guard — is that this delete is SOFT. The row survives, so a FINISHED order
 * keeps resolving through it and must not block; only work that has not
 * happened yet does. Getting that backwards in either direction is a real bug:
 * too strict and no plan can ever be retired, too loose and the catalogue
 * retires out from under scheduled work.
 */
@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private RecurringIgienizareRepository recurringRepository;
    @Mock private TaskRepository taskRepository;

    @InjectMocks
    private SubscriptionService subscriptionService;

    private static Subscription plan() {
        Subscription sub = new Subscription();
        sub.setId(1L);
        sub.setName("Igienizare lunară");
        sub.setIsActive(true);
        return sub;
    }

    private static IgienizareOrder order(long id, long number, Client client) {
        IgienizareOrder order = new IgienizareOrder();
        order.setId(id);
        order.setNumber(number);
        order.setClient(client);
        order.setSanitationDate("2026-09-14");
        return order;
    }

    private static Individual person(String fullName) {
        Individual individual = new Individual();
        individual.setId(7L);
        individual.setFullName(fullName);
        return individual;
    }

    // -----------------------------------------------------------------------
    // deactivate — the happy path
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldRetireWhenNothingLiveUsesThePlan() {
        Subscription sub = plan();
        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of());
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        subscriptionService.deactivate(1L);

        assertThat(sub.getIsActive()).isFalse();
        verify(subscriptionRepository).save(sub);
    }

    /**
     * The point of the soft delete: orders already carried out on this plan
     * keep pointing at a surviving row, so they are not a reason to refuse.
     * `findLiveBySubscriptionId` excludes them at the query level, so an empty
     * result here IS "only finished orders remain".
     */
    @Test
    void deactivate_shouldRetireWhenOnlyFinishedOrdersRemain() {
        Subscription sub = plan();
        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of());
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        subscriptionService.deactivate(1L);

        assertThat(sub.getIsActive()).isFalse();
    }

    // -----------------------------------------------------------------------
    // deactivate — the row lock that makes the check-then-act atomic (TODO-39)
    // -----------------------------------------------------------------------

    /**
     * The read that starts the retirement must be the LOCKING one.
     *
     * A plain findById reads the plan and lets go, so a POST /api/orders can
     * commit a live order between the blocker check and the isActive write —
     * and because that transaction never touches the subscriptions row there is
     * nothing to conflict on. findByIdForUpdate holds the row for the rest of
     * the transaction, and the order paths take the same lock. Swapping it back
     * for findById is a silent reopening of the hole, so pin it here.
     */
    @Test
    void deactivate_takesTheRowLockRatherThanAPlainRead() {
        Subscription sub = plan();
        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of());
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        subscriptionService.deactivate(1L);

        verify(subscriptionRepository).findByIdForUpdate(1L);
        verify(subscriptionRepository, never()).findById(any());
    }

    /**
     * The lock needs a transaction to live in: without @Transactional Spring
     * gives each repository call its own, so the FOR UPDATE would be released
     * the moment the SELECT returned — before the blocker check even runs.
     */
    @Test
    void deactivate_isTransactional() throws NoSuchMethodException {
        var method = SubscriptionService.class.getMethod("deactivate", Long.class);

        boolean transactional =
                method.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)
                        || SubscriptionService.class.isAnnotationPresent(
                                org.springframework.transaction.annotation.Transactional.class);

        assertThat(transactional)
                .as("SubscriptionService.deactivate must stay @Transactional — the row lock "
                        + "it takes is only held for the length of the transaction")
                .isTrue();
    }

    @Test
    void deactivate_shouldStill404ForAnUnknownPlan() {
        when(subscriptionRepository.findByIdForUpdate(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriptionService.deactivate(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // deactivate — refusals
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldThrowWhenAnUnfinishedOrderUsesThePlan() {
        Subscription sub = plan();
        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L))
                .thenReturn(List.of(order(10L, 41L, person("Ana Pop"))));
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        assertThatThrownBy(() -> subscriptionService.deactivate(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Nu se poate șterge abonamentul")
                .hasMessageContaining("1 comandă nefinalizată");

        assertThat(sub.getIsActive()).isTrue();
        verify(subscriptionRepository, never()).save(any());
    }

    /**
     * An active plan is the stronger blocker: it would keep MAKING new orders
     * against a retired subscription every night, so it refuses even when no
     * order is outstanding today.
     */
    @Test
    void deactivate_shouldThrowWhenAnActiveRecurringPlanUsesIt() {
        Subscription sub = plan();
        RecurringIgienizare recurring = new RecurringIgienizare();
        recurring.setId(5L);
        recurring.setClient(person("Ana Pop"));
        recurring.setFrequencyDays(30);

        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of());
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of(recurring));

        assertThatThrownBy(() -> subscriptionService.deactivate(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1 plan recurent activ");

        assertThat(sub.getIsActive()).isTrue();
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void deactivate_shouldNameBothKindsOfBlocker() {
        Subscription sub = plan();
        RecurringIgienizare recurring = new RecurringIgienizare();
        recurring.setId(5L);

        when(subscriptionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(sub));
        when(orderRepository.findLiveBySubscriptionId(1L))
                .thenReturn(List.of(order(10L, 41L, person("Ana Pop")), order(11L, 42L, person("Ana Pop"))));
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of(recurring));

        assertThatThrownBy(() -> subscriptionService.deactivate(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("2 comenzi nefinalizate")
                .hasMessageContaining("și")
                .hasMessageContaining("1 plan recurent activ");
    }

    // -----------------------------------------------------------------------
    // The Romanian counting in the refusal message
    // -----------------------------------------------------------------------
    @Test
    void blockedMessage_shouldAgreeInRomanian() {
        // Singular verb and noun at one.
        assertThat(SubscriptionService.blockedMessage(1, 0))
                .contains("1 comandă nefinalizată")
                .contains("îl folosește încă");
        // Plural verb from two up.
        assertThat(SubscriptionService.blockedMessage(3, 0))
                .contains("3 comenzi nefinalizate")
                .contains("îl folosesc încă");
        // "de" appears once the last two digits reach 20 — 24 DE comenzi.
        assertThat(SubscriptionService.blockedMessage(24, 0)).contains("24 de comenzi nefinalizate");
        // ...but not at 19.
        assertThat(SubscriptionService.blockedMessage(19, 0)).contains("19 comenzi nefinalizate");
    }

    // -----------------------------------------------------------------------
    // usage — the advisory preflight
    // -----------------------------------------------------------------------
    @Test
    void usage_shouldReportNotBlockedWhenNothingUsesThePlan() {
        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(plan()));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of());
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        SubscriptionUsageResponse usage = subscriptionService.usage(1L);

        assertThat(usage.blocked()).isFalse();
        assertThat(usage.orders()).isEmpty();
        assertThat(usage.recurringPlans()).isEmpty();
    }

    @Test
    void usage_shouldNameTheBlockingOrdersSoTheUiCanListThem() {
        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(plan()));
        when(orderRepository.findLiveBySubscriptionId(1L))
                .thenReturn(List.of(order(10L, 41L, person("Ana Pop"))));
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        SubscriptionUsageResponse usage = subscriptionService.usage(1L);

        assertThat(usage.blocked()).isTrue();
        assertThat(usage.orders()).singleElement().satisfies(blocking -> {
            assertThat(blocking.id()).isEqualTo(10L);
            assertThat(blocking.number()).isEqualTo(41L);
            assertThat(blocking.clientName()).isEqualTo("Ana Pop");
            assertThat(blocking.sanitationDate()).isEqualTo("2026-09-14");
        });
    }

    /** Company clients carry their name on a different field than individuals. */
    @Test
    void usage_shouldResolveACompanyClientName() {
        Company company = new Company();
        company.setId(8L);
        company.setName("Construct SRL");

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(plan()));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of(order(10L, 41L, company)));
        when(recurringRepository.findBySubscription_IdAndActiveTrue(1L)).thenReturn(List.of());

        SubscriptionUsageResponse usage = subscriptionService.usage(1L);

        assertThat(usage.orders()).singleElement()
                .extracting(SubscriptionUsageResponse.BlockingOrder::clientName)
                .isEqualTo("Construct SRL");
    }

    // -----------------------------------------------------------------------
    // moveOrders — the way out of a refused delete (TODO-37)
    // -----------------------------------------------------------------------

    private static Subscription otherPlan() {
        Subscription sub = new Subscription();
        sub.setId(2L);
        sub.setName("Igienizare trimestrială");
        sub.setIsActive(true);
        return sub;
    }

    private static Task task(long id, TaskStatus status, String productName) {
        Task task = new Task();
        task.setId(id);
        task.setStatus(status);
        task.setProductName(productName);
        return task;
    }

    @Test
    void moveOrders_shouldRepointTheOrderAndItsPendingTasks() {
        Subscription source = plan();
        Subscription target = otherPlan();
        IgienizareOrder live = order(10L, 101L, person("Ana Pop"));
        live.setSubscription(source);
        Task pending = task(55L, TaskStatus.NEW, "Igienizare lunară");

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(source));
        when(subscriptionRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of(live));
        when(orderRepository.findById(10L)).thenReturn(Optional.of(live));
        when(taskRepository.findAllByOrder_IdOrderByIdAsc(10L)).thenReturn(List.of(pending));

        assertThat(subscriptionService.moveOrders(1L, 2L, List.of(10L))).isEqualTo(1);

        assertThat(live.getSubscription()).isSameAs(target);
        // Task.productName is a COPY of the plan name; leaving it behind would
        // send the driver out with the old plan on their screen.
        assertThat(pending.getProductName()).isEqualTo("Igienizare trimestrială");
        verify(orderRepository).save(live);
        verify(taskRepository).save(pending);
    }

    @Test
    void moveOrders_shouldLeaveCompletedTasksAlone() {
        Subscription source = plan();
        Subscription target = otherPlan();
        IgienizareOrder live = order(10L, 101L, person("Ana Pop"));
        live.setSubscription(source);
        Task done = task(55L, TaskStatus.COMPLETED, "Igienizare lunară");

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(source));
        when(subscriptionRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of(live));
        when(orderRepository.findById(10L)).thenReturn(Optional.of(live));
        when(taskRepository.findAllByOrder_IdOrderByIdAsc(10L)).thenReturn(List.of(done));

        subscriptionService.moveOrders(1L, 2L, List.of(10L));

        // A completed task records what was DONE, not what to do. (A live order
        // cannot have one anyway - findLiveBySubscriptionId excludes it - so this
        // pins the belt as well as the braces.)
        assertThat(done.getProductName()).isEqualTo("Igienizare lunară");
        verify(taskRepository, never()).save(done);
    }

    @Test
    void moveOrders_shouldRefuseAnOrderThatIsNoLongerLive() {
        Subscription source = plan();
        Subscription target = otherPlan();
        IgienizareOrder stillLive = order(10L, 101L, person("Ana Pop"));

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(source));
        when(subscriptionRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        // 11 was in the dialog but has been completed (or moved) since.
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of(stillLive));

        assertThatThrownBy(() -> subscriptionService.moveOrders(1L, 2L, List.of(10L, 11L)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("nu mai este actuală");

        // All or nothing: the one that WAS still movable must not have moved.
        verify(orderRepository, never()).save(any());
    }

    @Test
    void moveOrders_shouldRefuseARetiredTarget() {
        Subscription source = plan();
        Subscription target = otherPlan();
        target.setIsActive(false);

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(source));
        when(subscriptionRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> subscriptionService.moveOrders(1L, 2L, List.of(10L)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("a fost dezactivat");
    }

    @Test
    void moveOrders_shouldTakeTheTargetsRowLockNotAPlainRead() {
        // The whole point of TODO-39: this attaches work to the target plan, so
        // it races deactivate() on that plan and must be ordered against it.
        Subscription source = plan();
        Subscription target = otherPlan();
        IgienizareOrder live = order(10L, 101L, person("Ana Pop"));

        when(subscriptionRepository.findById(1L)).thenReturn(Optional.of(source));
        when(subscriptionRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        when(orderRepository.findLiveBySubscriptionId(1L)).thenReturn(List.of(live));
        when(orderRepository.findById(10L)).thenReturn(Optional.of(live));
        when(taskRepository.findAllByOrder_IdOrderByIdAsc(10L)).thenReturn(List.of());

        subscriptionService.moveOrders(1L, 2L, List.of(10L));

        verify(subscriptionRepository).findByIdForUpdate(2L);
        verify(subscriptionRepository, never()).findById(2L);
    }

    @Test
    void moveOrders_shouldRefuseMovingAPlanOntoItself() {
        assertThatThrownBy(() -> subscriptionService.moveOrders(1L, 1L, List.of(10L)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deja pe acest abonament");
        verifyNoInteractions(orderRepository);
    }

    @Test
    void moveOrders_shouldRefuseAnEmptySelection() {
        assertThatThrownBy(() -> subscriptionService.moveOrders(1L, 2L, List.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("nicio comandă");
        verifyNoInteractions(orderRepository);
    }

    @Test
    void moveOrders_shouldRefuseAnUnknownSourcePlan() {
        when(subscriptionRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriptionService.moveOrders(9L, 2L, List.of(10L)))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
