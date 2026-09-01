package com.example.damiProd.service;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.RidicareOrder;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * The single backend answer to "is this order finished?".
 *
 * It is a deliberate mirror of {@code isFulfilled} / {@code deriveLifecycle} in
 * {@code web/src/lib/orderLifecycle.ts}: an order is fulfilled exactly when
 * that module would call its lifecycle {@code 'done'}. The two must agree,
 * because the web app uses the derivation to decide what counts as a CURRENT
 * order (Comenzi vs Arhivă) and the backend uses this to decide what counts as
 * a LIVE order blocking a delete. If one moves, move the other.
 *
 * The rule, in the same precedence order as the web version:
 *
 *   1. Task evidence outranks dates — a status is what someone reported on
 *      site, a date is only the plan.
 *        - every task COMPLETED            -> fulfilled
 *        - any task IN_PROGRESS            -> not fulfilled (active)
 *        - otherwise (no task finished and none under way) and the anchor
 *          date is in the past               -> not fulfilled (overdue)
 *        - otherwise fall through to dates
 *   2. Date reasoning, also used when the order has no tasks at all.
 *        - Amplasare occupies a site for a window: done only once the end date
 *          has passed; an indefinite placement is never done.
 *        - Ridicare/Igienizare are single-instant visits: done once the date
 *          is strictly behind us. A visit dated today is being worked.
 *   3. Anything the dates cannot decide ('unknown' on the web side) counts as
 *      NOT fulfilled. Refusing to retire a plan is recoverable; stranding live
 *      work is not.
 */
@Component
public class OrderFulfilmentPolicy {

    public boolean isFulfilled(Order order, List<Task> orderTasks, LocalDate today) {
        if (orderTasks != null && !orderTasks.isEmpty()) {
            if (orderTasks.stream().allMatch(task -> task.getStatus() == TaskStatus.COMPLETED)) {
                return true;
            }
            if (orderTasks.stream().anyMatch(task -> task.getStatus() == TaskStatus.IN_PROGRESS)) {
                return false;
            }
            // Nothing is finished and nothing is under way. If the anchor date
            // is already behind us that silence IS the signal: overdue, not
            // done. (CANCELLED lands here too. It exists in the backend enum
            // but NOT in the web TaskStatus union, whose summarizer collapses
            // everything that is neither COMPLETED nor IN_PROGRESS to NEW —
            // same outcome, so do not go looking for a CANCELLED branch there.)
            LocalDate anchor = parse(primaryDate(order));
            if (anchor != null && anchor.isBefore(today)) {
                return false;
            }
            // No verdict from tasks — fall through to the same date reasoning
            // an order with no tasks at all would get.
        }
        return isFulfilledByDates(order, today);
    }

    private boolean isFulfilledByDates(Order order, LocalDate today) {
        if (order instanceof AmplasareOrder amplasare) {
            LocalDate start = parse(amplasare.getStartDate());
            if (start == null) return false;                   // unknown
            if (today.isBefore(start)) return false;           // upcoming
            if (Boolean.TRUE.equals(amplasare.getIsIndefinite())) return false;
            LocalDate end = parse(amplasare.getEndDate());
            if (end == null) return false;                     // still active
            return today.isAfter(end);
        }

        LocalDate date = parse(primaryDate(order));
        if (date == null) return false;                        // unknown
        return today.isAfter(date);
    }

    /** Mirrors {@code orderPrimaryDate} in web/src/features/sales/orderModel.ts. */
    private String primaryDate(Order order) {
        if (order instanceof AmplasareOrder amplasare) return amplasare.getStartDate();
        if (order instanceof RidicareOrder ridicare) return ridicare.getPickupDate();
        if (order instanceof IgienizareOrder igienizare) return igienizare.getSanitationDate();
        return null;
    }

    /**
     * The date columns are ISO-8601 strings, not date columns. Anything that
     * does not parse is treated as absent, which lands on "not fulfilled" —
     * the same conservative side as a missing date.
     */
    private LocalDate parse(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }
}
