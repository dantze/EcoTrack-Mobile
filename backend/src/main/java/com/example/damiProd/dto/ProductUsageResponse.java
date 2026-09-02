package com.example.damiProd.dto;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.RidicareOrder;

import java.util.List;

/**
 * What still holds a product in the catalogue, for GET /api/products/{id}/usage.
 *
 * The counterpart of {@link SubscriptionUsageResponse}, and deliberately its
 * twin (TODO-57): retiring a product is refused by the same rule that refuses
 * to retire a subscription, so the refusal has to be equally answerable. Before
 * this existed a product delete said "3 comenzi nefinalizate îl folosesc încă"
 * and stopped there — the operator's next question is always <em>which</em>
 * three, and the only way to find out was to search Comenzi by hand.
 *
 * ADVISORY, exactly like the subscription one. The rule is enforced in
 * {@code ProductService.deleteProduct()}; a client that skips this call still
 * cannot retire a product that is in use.
 *
 * <strong>Two order types, not three.</strong> A product is carried by
 * Amplasare and Ridicare orders only — an Igienizare carries a subscription
 * instead — which is why this has one list where the subscription response has
 * two. There is deliberately no bulk move to go with it: moving an order to a
 * different product changes what is physically delivered, which is a decision
 * per order, not a bulk one.
 */
public record ProductUsageResponse(boolean blocked, List<BlockingOrder> orders) {

    /**
     * One unfinished order still using the product.
     *
     * {@code number} is the human-facing one, and {@code orderType} is the
     * Jackson discriminator ("Amplasari" / "Ridicari") so the UI can label the
     * row without a second lookup. {@code date} is the order's primary date —
     * start date for a placement, pickup date for a pickup — matching the web's
     * one definition of <em>when</em> an order happens (`orderPrimaryDate`).
     */
    public record BlockingOrder(Long id, long number, String clientName, String orderType,
                                String date, Integer quantity) {
    }

    public static ProductUsageResponse of(List<Order> liveOrders) {
        List<BlockingOrder> orders = liveOrders.stream()
                .map(order -> new BlockingOrder(
                        order.getId(),
                        order.getNumber(),
                        clientName(order.getClient()),
                        order.getOrderType(),
                        primaryDate(order),
                        quantity(order)))
                .toList();

        return new ProductUsageResponse(!orders.isEmpty(), orders);
    }

    /** Start date for a placement, pickup date for a pickup. */
    private static String primaryDate(Order order) {
        if (order instanceof AmplasareOrder amplasare) return amplasare.getStartDate();
        if (order instanceof RidicareOrder ridicare) return ridicare.getPickupDate();
        return null;
    }

    /** How many cabins the order moves — the two subtypes name it differently. */
    private static Integer quantity(Order order) {
        if (order instanceof AmplasareOrder amplasare) return amplasare.getQuantity();
        if (order instanceof RidicareOrder ridicare) return ridicare.getPickupQuantity();
        return null;
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
