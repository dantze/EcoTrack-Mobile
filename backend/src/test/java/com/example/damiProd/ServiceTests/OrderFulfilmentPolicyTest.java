package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.RidicareOrder;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.service.OrderFulfilmentPolicy;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The backend half of the shared "is this order finished?" rule.
 *
 * Every case here has a twin in the web unit tests for `deriveLifecycle`
 * (web/src/lib/orderLifecycle.ts): fulfilled here == 'done' there. If a case
 * ever disagrees, one of the two definitions has drifted.
 */
class OrderFulfilmentPolicyTest {

    private final OrderFulfilmentPolicy policy = new OrderFulfilmentPolicy();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 1);

    private Task task(TaskStatus status) {
        Task task = new Task();
        task.setStatus(status);
        return task;
    }

    private IgienizareOrder igienizare(String sanitationDate) {
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setSanitationDate(sanitationDate);
        return order;
    }

    // ── Task evidence outranks dates ────────────────────────────────────────

    @Test
    void allTasksCompleted_isFulfilled_evenWhenTheDateIsInTheFuture() {
        IgienizareOrder order = igienizare("2026-12-24");

        assertThat(policy.isFulfilled(order, List.of(task(TaskStatus.COMPLETED),
                task(TaskStatus.COMPLETED)), TODAY)).isTrue();
    }

    @Test
    void anyTaskInProgress_isNotFulfilled_evenWhenTheDateIsPast() {
        IgienizareOrder order = igienizare("2020-01-01");

        assertThat(policy.isFulfilled(order, List.of(task(TaskStatus.COMPLETED),
                task(TaskStatus.IN_PROGRESS)), TODAY)).isFalse();
    }

    @Test
    void allTasksStillNew_withAPastAnchor_isOverdueAndNotFulfilled() {
        IgienizareOrder order = igienizare("2026-08-01");

        assertThat(policy.isFulfilled(order, List.of(task(TaskStatus.NEW)), TODAY)).isFalse();
    }

    @Test
    void allTasksStillNew_withAFutureAnchor_fallsThroughToDates() {
        IgienizareOrder order = igienizare("2026-09-30");

        assertThat(policy.isFulfilled(order, List.of(task(TaskStatus.NEW)), TODAY)).isFalse();
    }

    // ── Date fallback: single-instant visits ────────────────────────────────

    @Test
    void igienizareWithNoTasks_isFulfilledOnlyOnceTheDateIsStrictlyPast() {
        assertThat(policy.isFulfilled(igienizare("2026-08-31"), List.of(), TODAY)).isTrue();
        // A visit dated today is being worked, not done.
        assertThat(policy.isFulfilled(igienizare("2026-09-01"), List.of(), TODAY)).isFalse();
        assertThat(policy.isFulfilled(igienizare("2026-09-02"), List.of(), TODAY)).isFalse();
    }

    @Test
    void ridicareWithNoTasks_usesItsPickupDate() {
        RidicareOrder order = new RidicareOrder();
        order.setOrderType("Ridicari");
        order.setPickupDate("2026-07-15");

        assertThat(policy.isFulfilled(order, List.of(), TODAY)).isTrue();
    }

    // ── Date fallback: placement windows ────────────────────────────────────

    @Test
    void amplasareIsFulfilledOnlyAfterItsEndDate() {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setStartDate("2026-01-01");
        order.setEndDate("2026-08-31");

        assertThat(policy.isFulfilled(order, List.of(), TODAY)).isTrue();

        order.setEndDate("2026-09-01");
        assertThat(policy.isFulfilled(order, List.of(), TODAY)).isFalse();
    }

    @Test
    void indefiniteAmplasareIsNeverFulfilledByDatesAlone() {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setStartDate("2020-01-01");
        order.setIsIndefinite(true);
        order.setEndDate("2020-02-01");

        assertThat(policy.isFulfilled(order, List.of(), TODAY)).isFalse();
    }

    // ── Unknown ─────────────────────────────────────────────────────────────

    @Test
    void anUndatedOrderIsNotFulfilled() {
        assertThat(policy.isFulfilled(igienizare(null), List.of(), TODAY)).isFalse();
        assertThat(policy.isFulfilled(igienizare("nu-i o dată"), List.of(), TODAY)).isFalse();
    }
}
