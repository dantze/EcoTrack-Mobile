package com.example.damiProd.dto;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.RecurringIgienizare;

import java.util.List;

/**
 * What still holds a subscription open, for GET /api/subscriptions/{id}/usage.
 *
 * This endpoint is ADVISORY — it exists so the UI can say "3 comenzi still use
 * this plan" and name them BEFORE the operator commits to a delete, instead of
 * only learning it from a rejected request. The actual rule is enforced in
 * SubscriptionService.deactivate(); a client that skips this call still cannot
 * retire a plan that is in use.
 *
 * Only the fields needed to identify a blocker are exposed, not whole orders —
 * the UI links each row through to Comenzi for the rest.
 */
public record SubscriptionUsageResponse(
        boolean blocked,
        List<BlockingOrder> orders,
        List<BlockingPlan> recurringPlans) {

    /** An unfinished Igienizare order. `number` is the human-facing one. */
    public record BlockingOrder(Long id, long number, String clientName, String sanitationDate) {
    }

    /** An active recurring plan, which would keep creating new orders. */
    public record BlockingPlan(Long id, String clientName, Integer frequencyDays) {
    }

    public static SubscriptionUsageResponse of(
            List<IgienizareOrder> liveOrders, List<RecurringIgienizare> activePlans) {
        List<BlockingOrder> orders = liveOrders.stream()
                .map(order -> new BlockingOrder(
                        order.getId(),
                        order.getNumber(),
                        clientName(order.getClient()),
                        order.getSanitationDate()))
                .toList();

        List<BlockingPlan> plans = activePlans.stream()
                .map(plan -> new BlockingPlan(
                        plan.getId(),
                        clientName(plan.getClient()),
                        plan.getFrequencyDays()))
                .toList();

        return new SubscriptionUsageResponse(
                !orders.isEmpty() || !plans.isEmpty(), orders, plans);
    }

    /**
     * Client is JOINED-inheritance, so the concrete subclass carries the name.
     * Falls back to the id rather than null — a blocker the operator cannot
     * identify is not much of an explanation.
     */
    private static String clientName(Client client) {
        if (client instanceof Company company) return company.getName();
        if (client instanceof Individual individual) return individual.getFullName();
        return client == null ? "—" : "Client #" + client.getId();
    }
}
