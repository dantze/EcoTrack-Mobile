package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final TaskRepository taskRepository;
    private final RecurringIgienizareRepository recurringIgienizareRepository;

    public OrderService(OrderRepository orderRepository, ClientRepository clientRepository,
            ProductRepository productRepository, SubscriptionRepository subscriptionRepository,
            TaskRepository taskRepository, RecurringIgienizareRepository recurringIgienizareRepository) {
        this.orderRepository = orderRepository;
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.taskRepository = taskRepository;
        this.recurringIgienizareRepository = recurringIgienizareRepository;
    }

    @Transactional
    public Order createOrder(Long clientId, Order order) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + clientId));
        order.setClient(client);

        // ─── Link product for Amplasare & Ridicare ───
        if (order instanceof AmplasareOrder amp && amp.getProduct() != null && amp.getProduct().getId() != null) {
            amp.setProduct(requireProduct(amp.getProduct().getId()));
        }
        if (order instanceof RidicareOrder rid && rid.getProduct() != null && rid.getProduct().getId() != null) {
            rid.setProduct(requireProduct(rid.getProduct().getId()));
        }

        // ─── Ridicare: validate available quantity before saving ─────────────
        if (order instanceof RidicareOrder rid
                && rid.getPickupLocationCoordinates() != null
                && rid.getPickupProductName() != null
                && rid.getPickupQuantity() != null) {

            int totalPlaced = orderRepository.sumAmplasareQuantityByClientLocationAndProduct(
                    clientId, rid.getPickupLocationCoordinates(), rid.getPickupProductName());
            int alreadyClaimed = orderRepository.sumRidicareQuantityByClientLocationAndProduct(
                    clientId, rid.getPickupLocationCoordinates(), rid.getPickupProductName());
            int available = totalPlaced - alreadyClaimed;

            if (rid.getPickupQuantity() > available) {
                throw new InsufficientQuantityException(
                        "Cantitate insuficientă la locație. Disponibil: " + available
                        + ", solicitat: " + rid.getPickupQuantity() + ".");
            }
        }

        // ─── Link subscription for Igienizare ───
        // The lock and the re-check are one unit (TODO-39): see lockSubscription.
        if (order instanceof IgienizareOrder igi && igi.getSubscription() != null
                && igi.getSubscription().getId() != null) {
            Subscription plan = lockSubscription(igi.getSubscription().getId());
            requireUsablePlan(plan);
            igi.setSubscription(plan);
        }

        Order saved = orderRepository.save(order);

        // The human-facing order number, which NOTHING assigned before this.
        // `number` is a primitive long, so every order created through the app
        // was saved as 0 and the Comenzi table showed "#0" for all of them —
        // invisible in mock mode, where the seed makes numbers up. It also made
        // `findLiveBySubscriptionId`'s `ORDER BY o.number ASC` an arbitrary
        // ordering over a column of zeroes.
        //
        // The id is the number: unique by construction, needs no MAX(number)+1
        // read that two concurrent creates could both win (the very race
        // TODO-39 is about), and it is already the number the URL shows. The
        // entity is managed inside this @Transactional, so the assignment
        // flushes on commit without a second save().
        if (saved.getNumber() == 0 && saved.getId() != null) {
            saved.setNumber(saved.getId());
        }
        return saved;
    }

    public List<Order> getOrdersByClient(Long clientId) {
        return orderRepository.findByClientId(clientId);
    }

    @Transactional
    public void deleteOrder(Long orderId) {
        // Check if this is an IgienizareOrder with a recurring plan
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order instanceof IgienizareOrder igi && igi.getRecurringPlan() != null) {
            Long planId = igi.getRecurringPlan().getId();
            // Delete ALL tasks generated by this recurring plan (must delete all to satisfy FK constraints)
            taskRepository.deleteByRecurringPlan_Id(planId);
            // Clear the order reference to the plan before deleting
            igi.setRecurringPlan(null);
            orderRepository.save(igi);
            // Delete the recurring plan itself
            recurringIgienizareRepository.deleteById(planId);
        }

        // Delete EVERY task directly linked to this order (TODO-34). Deleting
        // only the first one left the rest pointing at a row that is about to
        // go, so the order delete failed on the FK instead.
        taskRepository.deleteAll(taskRepository.findAllByOrder_IdOrderByIdAsc(orderId));
        orderRepository.deleteById(orderId);
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAllWithClientAndProduct();
    }

    public Order getOrderById(Long orderId) {
        return orderRepository.findByIdWithClientAndProduct(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));
    }

    @Transactional
    public Order updateOrder(Long orderId, Order orderDetails) {
        Order existingOrder = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));

        // ─── Shared fields ───
        if (orderDetails.getContact() != null)
            existingOrder.setContact(orderDetails.getContact());
        if (orderDetails.getDetails() != null)
            existingOrder.setDetails(orderDetails.getDetails());

        // ─── Amplasare-specific fields ───
        if (existingOrder instanceof AmplasareOrder existing && orderDetails instanceof AmplasareOrder updates) {
            if (updates.getProduct() != null && updates.getProduct().getId() != null) {
                existing.setProduct(requireProduct(updates.getProduct().getId()));
            }
            if (updates.getQuantity() != null)
                existing.setQuantity(updates.getQuantity());
            if (updates.getIsIndefinite() != null)
                existing.setIsIndefinite(updates.getIsIndefinite());
            if (updates.getDurationDays() != null)
                existing.setDurationDays(updates.getDurationDays());
            if (updates.getStartDate() != null)
                existing.setStartDate(updates.getStartDate());
            if (updates.getEndDate() != null)
                existing.setEndDate(updates.getEndDate());
            if (updates.getLocationCoordinates() != null)
                existing.setLocationCoordinates(updates.getLocationCoordinates());
            if (updates.getLocationAddress() != null)
                existing.setLocationAddress(updates.getLocationAddress());
            if (updates.getIgienizariPerMonth() != null)
                existing.setIgienizariPerMonth(updates.getIgienizariPerMonth());
        }

        // ─── Ridicare-specific fields ───
        if (existingOrder instanceof RidicareOrder existing && orderDetails instanceof RidicareOrder updates) {
            if (updates.getProduct() != null && updates.getProduct().getId() != null) {
                existing.setProduct(requireProduct(updates.getProduct().getId()));
            }
            if (updates.getPickupDate() != null)
                existing.setPickupDate(updates.getPickupDate());
            if (updates.getPickupQuantity() != null)
                existing.setPickupQuantity(updates.getPickupQuantity());
            if (updates.getPickupProductName() != null)
                existing.setPickupProductName(updates.getPickupProductName());
            if (updates.getPickupLocationAddress() != null)
                existing.setPickupLocationAddress(updates.getPickupLocationAddress());
            if (updates.getPickupLocationCoordinates() != null)
                existing.setPickupLocationCoordinates(updates.getPickupLocationCoordinates());
        }

        // ─── Igienizare-specific fields ───
        if (existingOrder instanceof IgienizareOrder existing && orderDetails instanceof IgienizareOrder updates) {
            if (updates.getSubscription() != null && updates.getSubscription().getId() != null) {
                Subscription plan = lockSubscription(updates.getSubscription().getId());
                // Only a MOVE to a different plan has to be refused. Re-sending
                // the plan an order already sits on must keep working: a finished
                // order legitimately points at a retired plan (the delete is
                // soft), and editing its address should not be blocked by that.
                Long current = existing.getSubscription() != null ? existing.getSubscription().getId() : null;
                if (!plan.getId().equals(current)) {
                    requireUsablePlan(plan);
                }
                existing.setSubscription(plan);
            }
            if (updates.getSanitationDate() != null)
                existing.setSanitationDate(updates.getSanitationDate());
            if (updates.getSanitationLocationAddress() != null)
                existing.setSanitationLocationAddress(updates.getSanitationLocationAddress());
            if (updates.getSanitationLocationCoordinates() != null)
                existing.setSanitationLocationCoordinates(updates.getSanitationLocationCoordinates());
        }

        return orderRepository.save(existingOrder);
    }

    /**
     * A client sends products and subscriptions as {"id": n} stubs; both create
     * and update have to swap the stub for the managed entity before saving, or
     * Hibernate persists a detached copy.
     */
    private Product requireProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
    }

    /**
     * The plan, taken with SELECT … FOR UPDATE (TODO-39).
     *
     * Attaching an order to a plan and retiring that plan are a check-then-act
     * against each other: SubscriptionService.deactivate reads "nothing live
     * points at this plan" and then writes isActive = false, and this method's
     * caller commits exactly the row that would have made that read say no.
     * Neither transaction used to touch the other's rows, so nothing conflicted
     * and both could win — leaving a live order on a retired plan.
     *
     * Both sides now take this lock on the same subscription row, which orders
     * them. Ordering alone is not the fix: whoever comes second still has to
     * LOOK. deactivate re-reads the blockers under the lock, and the caller here
     * re-checks isActive through requireUsablePlan.
     */
    private Subscription lockSubscription(Long id) {
        return subscriptionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + id));
    }

    /**
     * Refuses a retired plan, read under the lock taken above.
     *
     * Delegates to {@link SubscriptionService#requireUsablePlan} so that this,
     * RecurringIgienizareService and the bulk move (TODO-37) cannot drift into
     * three slightly different answers to one question.
     */
    private static void requireUsablePlan(Subscription plan) {
        SubscriptionService.requireUsablePlan(plan, "pentru comenzi noi");
    }
}
