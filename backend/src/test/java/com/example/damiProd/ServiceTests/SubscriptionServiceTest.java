package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.exception.ResourceInUseException;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.service.OrderFulfilmentPolicy;
import com.example.damiProd.service.SubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/**
 * Retiring a plan (DELETE /api/subscriptions/{id} → soft delete) must be
 * refused while UNFULFILLED orders still reference it, and must still work
 * when the only referencing orders are history.
 *
 * The real {@link OrderFulfilmentPolicy} is wired in rather than mocked — the
 * whole point of these tests is the rule, not the plumbing around it.
 */
@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private TaskRepository taskRepository;

    private SubscriptionService subscriptionService;

    /** Comfortably in the past, so a date-only order reads as fulfilled. */
    private static final String PAST = "2020-01-01";
    /** Comfortably in the future, so a date-only order reads as live. */
    private static final String FUTURE = LocalDate.now().plusYears(5).toString();

    @BeforeEach
    void setUp() {
        subscriptionService = new SubscriptionService(
                subscriptionRepository, orderRepository, taskRepository, new OrderFulfilmentPolicy());
    }

    private Subscription plan() {
        Subscription sub = new Subscription();
        sub.setId(7L);
        sub.setName("Igienizare lunară");
        sub.setIsActive(true);
        when(subscriptionRepository.findById(7L)).thenReturn(Optional.of(sub));
        return sub;
    }

    private IgienizareOrder order(long id, long number, String sanitationDate) {
        IgienizareOrder order = new IgienizareOrder();
        order.setId(id);
        order.setNumber(number);
        order.setOrderType("Igienizari");
        order.setSanitationDate(sanitationDate);
        Company client = new Company();
        client.setName("SC Ecotest SRL");
        order.setClient(client);
        return order;
    }

    private Task taskFor(Order order, TaskStatus status) {
        Task task = new Task();
        task.setStatus(status);
        task.setOrder(order);
        return task;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — nothing references the plan → soft delete goes through
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldRetirePlanWhenNoOrderReferencesIt() {
        Subscription sub = plan();
        when(orderRepository.findIgienizareOrdersBySubscriptionId(7L)).thenReturn(List.of());

        subscriptionService.deactivate(7L);

        assertThat(sub.getIsActive()).isFalse();
        verify(subscriptionRepository).save(sub);
        verify(taskRepository, never()).findByOrder_IdIn(anyCollection());
    }

    // -----------------------------------------------------------------------
    // TEST 2 — only fulfilled orders reference it → soft delete goes through
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldRetirePlanWhenOnlyFulfilledOrdersReferenceIt() {
        Subscription sub = plan();
        // One finished by task evidence (all COMPLETED, even though its date is
        // in the future), one finished by date with no tasks at all.
        IgienizareOrder byTasks = order(101L, 1001L, FUTURE);
        IgienizareOrder byDate = order(102L, 1002L, PAST);
        when(orderRepository.findIgienizareOrdersBySubscriptionId(7L))
                .thenReturn(List.of(byTasks, byDate));
        when(taskRepository.findByOrder_IdIn(List.of(101L, 102L)))
                .thenReturn(List.of(taskFor(byTasks, TaskStatus.COMPLETED),
                        taskFor(byTasks, TaskStatus.COMPLETED)));

        subscriptionService.deactivate(7L);

        assertThat(sub.getIsActive()).isFalse();
        verify(subscriptionRepository).save(sub);
    }

    // -----------------------------------------------------------------------
    // TEST 3 — an unfulfilled order refuses the delete and names the blocker
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldRefuseWhenAnUnfulfilledOrderReferencesIt() {
        Subscription sub = plan();
        IgienizareOrder live = order(103L, 1003L, FUTURE);
        when(orderRepository.findIgienizareOrdersBySubscriptionId(7L)).thenReturn(List.of(live));
        when(taskRepository.findByOrder_IdIn(List.of(103L))).thenReturn(List.of());

        assertThatThrownBy(() -> subscriptionService.deactivate(7L))
                .isInstanceOf(ResourceInUseException.class)
                // Message is Romanian and user-facing.
                .hasMessageContaining("Abonamentul nu poate fi șters")
                .hasMessageContaining("1 comandă nefinalizată")
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(ResourceInUseException.class))
                .satisfies(ex -> {
                    assertThat(ex.getBlockingOrders()).hasSize(1);
                    assertThat(ex.getBlockingOrders().get(0).id()).isEqualTo(103L);
                    assertThat(ex.getBlockingOrders().get(0).number()).isEqualTo(1003L);
                    assertThat(ex.getBlockingOrders().get(0).orderType()).isEqualTo("Igienizari");
                    assertThat(ex.getBlockingOrders().get(0).clientName()).isEqualTo("SC Ecotest SRL");
                    assertThat(ex.getBlockingOrders().get(0).date()).isEqualTo(FUTURE);
                });

        // Nothing was written: the plan is still live.
        assertThat(sub.getIsActive()).isTrue();
        verify(subscriptionRepository, never()).save(any(Subscription.class));
    }

    // -----------------------------------------------------------------------
    // TEST 4 — a half-done order still blocks, and only the blockers are listed
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldListOnlyTheUnfulfilledOrders() {
        plan();
        IgienizareOrder done = order(201L, 2001L, PAST);
        IgienizareOrder halfDone = order(202L, 2002L, PAST);
        when(orderRepository.findIgienizareOrdersBySubscriptionId(7L))
                .thenReturn(List.of(done, halfDone));
        when(taskRepository.findByOrder_IdIn(List.of(201L, 202L)))
                .thenReturn(List.of(
                        taskFor(done, TaskStatus.COMPLETED),
                        taskFor(halfDone, TaskStatus.COMPLETED),
                        taskFor(halfDone, TaskStatus.IN_PROGRESS)));

        assertThatThrownBy(() -> subscriptionService.deactivate(7L))
                .isInstanceOf(ResourceInUseException.class)
                .hasMessageContaining("1 comandă nefinalizată")
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.type(ResourceInUseException.class))
                .satisfies(ex -> assertThat(ex.getBlockingOrders())
                        .extracting(blocker -> blocker.id())
                        .containsExactly(202L));
    }

    // -----------------------------------------------------------------------
    // TEST 5 — plural wording when more than one order blocks
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldUsePluralWordingForSeveralBlockers() {
        plan();
        when(orderRepository.findIgienizareOrdersBySubscriptionId(7L))
                .thenReturn(List.of(order(301L, 3001L, FUTURE), order(302L, 3002L, FUTURE)));
        when(taskRepository.findByOrder_IdIn(List.of(301L, 302L))).thenReturn(List.of());

        assertThatThrownBy(() -> subscriptionService.deactivate(7L))
                .isInstanceOf(ResourceInUseException.class)
                .hasMessageContaining("2 comenzi nefinalizate");
    }

    // -----------------------------------------------------------------------
    // TEST 6 — an unknown id is still a 404, checked before anything else
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldThrowNotFoundForUnknownId() {
        when(subscriptionRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriptionService.deactivate(99L))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(orderRepository, never()).findIgienizareOrdersBySubscriptionId(any());
    }
}
