package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class RecurringIgienizareService {

    private final RecurringIgienizareRepository recurringRepo;
    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final RouteRepository routeRepository;
    private final TaskService taskService;

    public RecurringIgienizareService(RecurringIgienizareRepository recurringRepo,
                                      OrderRepository orderRepository,
                                      ClientRepository clientRepository,
                                      SubscriptionRepository subscriptionRepository,
                                      RouteRepository routeRepository,
                                      TaskService taskService) {
        this.recurringRepo = recurringRepo;
        this.orderRepository = orderRepository;
        this.clientRepository = clientRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.routeRepository = routeRepository;
        this.taskService = taskService;
    }

    // ─── CRUD ────────────────────────────────────────────────────────────

    public List<RecurringIgienizare> getAll() {
        return recurringRepo.findAll();
    }

    public List<RecurringIgienizare> getActiveOnly() {
        return recurringRepo.findByActiveTrue();
    }

    public List<RecurringIgienizare> getByClient(Long clientId) {
        return recurringRepo.findByClientId(clientId);
    }

    public RecurringIgienizare getById(Long id) {
        return recurringRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("RecurringIgienizare not found with id: " + id));
    }

    /**
     * Create a recurring igienizare plan and a single IgienizareOrder for it.
     */
    @Transactional
    public RecurringIgienizare create(Long clientId, RecurringIgienizare plan) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + clientId));
        plan.setClient(client);

        // Link subscription
        if (plan.getSubscription() != null && plan.getSubscription().getId() != null) {
            Subscription sub = subscriptionRepository.findById(plan.getSubscription().getId())
                    .orElseThrow(() -> new RuntimeException(
                            "Subscription not found with id: " + plan.getSubscription().getId()));
            plan.setSubscription(sub);
        }

        // Link route if provided
        if (plan.getRoute() != null && plan.getRoute().getId() != null) {
            Route route = routeRepository.findById(plan.getRoute().getId())
                    .orElseThrow(() -> new RuntimeException(
                            "Route not found with id: " + plan.getRoute().getId()));
            plan.setRoute(route);
        }

        plan.setActive(true);
        RecurringIgienizare saved = recurringRepo.save(plan);

        // Create a single IgienizareOrder for this plan
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setDate(new Date());
        order.setClient(client);
        order.setSubscription(plan.getSubscription());
        order.setSanitationDate(plan.getStartDate() != null ? plan.getStartDate().toString() : null);
        order.setSanitationLocationAddress(plan.getSanitationLocationAddress());
        order.setSanitationLocationCoordinates(plan.getSanitationLocationCoordinates());
        order.setContact(plan.getContact());
        order.setDetails(plan.getDetails());

        IgienizareOrder savedOrder = (IgienizareOrder) orderRepository.save(order);

        // Create task if a route is assigned
        if (plan.getRoute() != null) {
            try {
                taskService.createTaskFromOrder(savedOrder.getId(), plan.getRoute().getId());
            } catch (RuntimeException e) {
                // Task already exists — ignore
            }
        }

        return saved;
    }

    @Transactional
    public RecurringIgienizare assignRoute(Long planId, Long routeId) {
        RecurringIgienizare plan = getById(planId);
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new RuntimeException("Route not found with id: " + routeId));
        plan.setRoute(route);
        return recurringRepo.save(plan);
    }

    @Transactional
    public RecurringIgienizare deactivate(Long planId) {
        RecurringIgienizare plan = getById(planId);
        plan.setActive(false);
        return recurringRepo.save(plan);
    }
}
