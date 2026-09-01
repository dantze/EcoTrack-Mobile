package com.example.damiProd.service;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.Task;
import com.example.damiProd.dto.BlockingOrderRef;
import com.example.damiProd.exception.ResourceInUseException;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final OrderFulfilmentPolicy fulfilmentPolicy;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               OrderRepository orderRepository,
                               TaskRepository taskRepository,
                               OrderFulfilmentPolicy fulfilmentPolicy) {
        this.subscriptionRepository = subscriptionRepository;
        this.orderRepository = orderRepository;
        this.taskRepository = taskRepository;
        this.fulfilmentPolicy = fulfilmentPolicy;
    }

    /** Returns only active plans — used for frontend dropdowns */
    public List<Subscription> getActiveSubscriptions() {
        return subscriptionRepository.findByIsActiveTrue();
    }

    /** Returns all plans including retired ones — used for admin views */
    public List<Subscription> getAllSubscriptions() {
        return subscriptionRepository.findAll();
    }

    public Subscription getById(Long id) {
        return subscriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + id));
    }

    public Subscription save(Subscription subscription) {
        return subscriptionRepository.save(subscription);
    }

    public Subscription update(Long id, Subscription updated) {
        Subscription existing = getById(id);
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setType(updated.getType());
        existing.setPrice(updated.getPrice());
        existing.setVisitsPerMonth(updated.getVisitsPerMonth());
        existing.setDurationMonths(updated.getDurationMonths());
        existing.setIsIndefinite(updated.getIsIndefinite());
        existing.setIsActive(updated.getIsActive());
        return subscriptionRepository.save(existing);
    }

    /**
     * Soft-deletes the plan, unless live work still depends on it.
     *
     * "In use" means an Igienizare order that references this plan and is NOT
     * yet fulfilled, per {@link OrderFulfilmentPolicy}. Fulfilled orders are
     * history: they keep resolving through the isActive flag exactly as they do
     * today, and blocking on them would make a long-lived plan permanently
     * undeletable. Unfulfilled orders are live work that retiring the plan
     * would strand.
     *
     * Transactional so the "who is blocking" read and the write that follows it
     * see one consistent snapshot.
     */
    @Transactional
    public void deactivate(Long id) {
        Subscription sub = getById(id);

        List<BlockingOrderRef> blockers = findBlockingOrders(id);
        if (!blockers.isEmpty()) {
            throw new ResourceInUseException(
                    "Abonamentul nu poate fi șters: este folosit de " + blockers.size()
                            + (blockers.size() == 1 ? " comandă nefinalizată." : " comenzi nefinalizate.")
                            + " Finalizați sau ștergeți comenzile, apoi încercați din nou.",
                    blockers);
        }

        sub.setIsActive(false);
        subscriptionRepository.save(sub);
    }

    /**
     * Every unfulfilled order referencing this plan, as a flat list the error
     * response can carry. Tasks are loaded in one query and grouped in memory
     * rather than fanned out per order.
     */
    List<BlockingOrderRef> findBlockingOrders(Long subscriptionId) {
        List<IgienizareOrder> orders = orderRepository.findIgienizareOrdersBySubscriptionId(subscriptionId);
        if (orders.isEmpty()) {
            return List.of();
        }

        List<Long> orderIds = orders.stream().map(IgienizareOrder::getId).toList();
        Map<Long, List<Task>> tasksByOrder = taskRepository.findByOrder_IdIn(orderIds).stream()
                .filter(task -> task.getOrder() != null && task.getOrder().getId() != null)
                .collect(Collectors.groupingBy(task -> task.getOrder().getId()));

        LocalDate today = LocalDate.now();
        List<BlockingOrderRef> blockers = new ArrayList<>();
        for (IgienizareOrder order : orders) {
            List<Task> tasks = tasksByOrder.getOrDefault(order.getId(), Collections.emptyList());
            if (!fulfilmentPolicy.isFulfilled(order, tasks, today)) {
                blockers.add(new BlockingOrderRef(
                        order.getId(),
                        order.getNumber(),
                        order.getOrderType(),
                        clientLabel(order.getClient()),
                        order.getSanitationDate()));
            }
        }
        return blockers;
    }

    private String clientLabel(Client client) {
        if (client instanceof Company company) return company.getName();
        if (client instanceof Individual individual) return individual.getFullName();
        return "Client necunoscut";
    }
}
