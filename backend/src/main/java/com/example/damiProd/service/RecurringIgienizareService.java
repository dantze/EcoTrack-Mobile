package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class RecurringIgienizareService {

    private static final int LOOKAHEAD_DAYS = 90; // For indefinite plans, generate 90 days ahead

    private final RecurringIgienizareRepository recurringRepo;
    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final ClientRepository clientRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final RouteRepository routeRepository;

    public RecurringIgienizareService(RecurringIgienizareRepository recurringRepo,
                                      OrderRepository orderRepository,
                                      TaskRepository taskRepository,
                                      ClientRepository clientRepository,
                                      SubscriptionRepository subscriptionRepository,
                                      RouteRepository routeRepository) {
        this.recurringRepo = recurringRepo;
        this.orderRepository = orderRepository;
        this.taskRepository = taskRepository;
        this.clientRepository = clientRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.routeRepository = routeRepository;
    }

    // ─── CRUD ────────────────────────────────────────────────────────────

    public List<RecurringIgienizare> getAll() {
        return recurringRepo.findAll();
    }

    public List<RecurringIgienizare> getActiveOnly() {
        return recurringRepo.findByActiveTrue();
    }

    public List<RecurringIgienizare> getUnassigned() {
        return recurringRepo.findByActiveTrueAndRouteIsNull();
    }

    public List<RecurringIgienizare> getByClient(Long clientId) {
        return recurringRepo.findByClientId(clientId);
    }

    public RecurringIgienizare getById(Long id) {
        return recurringRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringIgienizare not found with id: " + id));
    }

    // ─── CREATE ──────────────────────────────────────────────────────────

    /**
     * Create a recurring igienizare plan and an initial IgienizareOrder (visible in orders list).
     * If a route is assigned, generates recurring tasks automatically.
     */
    @Transactional
    public RecurringIgienizare create(Long clientId, RecurringIgienizare plan) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + clientId));
        plan.setClient(client);

        // Link subscription.
        //
        // The SAME row lock the retirement takes (TODO-39). This is the second
        // path that can invalidate SubscriptionService.deactivate's read, and
        // the stronger one: it commits an ACTIVE recurring plan AND an initial
        // live order, either of which deactivate would have refused. Locking
        // orders the two; the isActive re-check under the lock is what makes the
        // loser refuse instead of proceeding against a plan that just retired.
        if (plan.getSubscription() != null && plan.getSubscription().getId() != null) {
            Subscription sub = subscriptionRepository.findByIdForUpdate(plan.getSubscription().getId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Subscription not found with id: " + plan.getSubscription().getId()));
            // One implementation of "a retired plan takes no new work", shared with
            // OrderService and the bulk move (TODO-37).
            SubscriptionService.requireUsablePlan(sub, "pentru planuri recurente noi");
            plan.setSubscription(sub);
        }

        // Link route if provided
        if (plan.getRoute() != null && plan.getRoute().getId() != null) {
            Route route = routeRepository.findById(plan.getRoute().getId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Route not found with id: " + plan.getRoute().getId()));
            plan.setRoute(route);
        }

        // Defaults
        plan.setActive(true);
        if (plan.getFrequencyDays() == null) {
            plan.setFrequencyDays(30);
        }

        RecurringIgienizare saved = recurringRepo.save(plan);

        // Create the initial IgienizareOrder (visible in orders list)
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setDate(new java.util.Date());
        order.setClient(client);
        order.setSubscription(plan.getSubscription());
        order.setSanitationDate(plan.getStartDate() != null ? plan.getStartDate().toString() : null);
        order.setSanitationLocationAddress(plan.getSanitationLocationAddress());
        order.setSanitationLocationCoordinates(plan.getSanitationLocationCoordinates());
        order.setContact(plan.getContact());
        order.setDetails(plan.getDetails());
        order.setRecurringPlan(saved);
        orderRepository.save(order);

        // If a route is already assigned, generate recurring tasks immediately
        if (saved.getRoute() != null) {
            generateTasksForPlan(saved);
        }

        return saved;
    }

    // ─── ASSIGN ROUTE ────────────────────────────────────────────────────

    @Transactional
    public RecurringIgienizare assignRoute(Long planId, Long routeId) {
        RecurringIgienizare plan = getById(planId);
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new ResourceNotFoundException("Route not found with id: " + routeId));
        plan.setRoute(route);
        RecurringIgienizare saved = recurringRepo.save(plan);

        // Generate tasks on the newly assigned route
        generateTasksForPlan(saved);

        return saved;
    }

    // ─── DEACTIVATE ──────────────────────────────────────────────────────

    @Transactional
    public RecurringIgienizare deactivate(Long planId) {
        RecurringIgienizare plan = getById(planId);
        plan.setActive(false);

        // Also remove all non-completed tasks so they stop appearing on routes
        taskRepository.deleteNonCompletedByRecurringPlanId(planId);

        return recurringRepo.save(plan);
    }

    // ─── DELETE (full removal) ───────────────────────────────────────────

    /**
     * Fully delete a recurring plan and all its non-completed tasks.
     * Called when the associated IgienizareOrder is deleted from the orders list.
     */
    @Transactional
    public void delete(Long planId) {
        // First remove all tasks generated by this plan (non-completed ones)
        taskRepository.deleteNonCompletedByRecurringPlanId(planId);

        // Then delete the plan itself
        recurringRepo.deleteById(planId);
    }

    // ─── TASK GENERATION ─────────────────────────────────────────────────

    /**
     * Generate tasks for a recurring plan from startDate to endDate (or today + LOOKAHEAD_DAYS
     * for indefinite plans). Skips dates that already have a task.
     */
    @Transactional
    public void generateTasksForPlan(RecurringIgienizare plan) {
        if (plan.getRoute() == null || plan.getStartDate() == null || !Boolean.TRUE.equals(plan.getActive())) {
            return;
        }

        int frequency = plan.getFrequencyDays() != null ? plan.getFrequencyDays() : 30;
        LocalDate start = plan.getStartDate();
        LocalDate today = LocalDate.now();

        // Determine the end boundary
        LocalDate endBoundary;
        if (Boolean.TRUE.equals(plan.getIsIndefinite()) || plan.getEndDate() == null) {
            endBoundary = today.plusDays(LOOKAHEAD_DAYS);
        } else {
            endBoundary = plan.getEndDate();
        }

        // If we've already generated up to a certain date, start from after that
        if (plan.getLastGeneratedDate() != null && plan.getLastGeneratedDate().isAfter(start)) {
            start = plan.getLastGeneratedDate().plusDays(1);
        }

        // Build client name
        String clientName = "Client necunoscut";
        Client client = plan.getClient();
        if (client instanceof Company) {
            clientName = ((Company) client).getName();
        } else if (client instanceof Individual) {
            clientName = ((Individual) client).getFullName();
        }

        String clientPhone = client != null ? client.getPhone() : null;

        // Generate tasks at the defined frequency
        LocalDate date = plan.getStartDate();
        // Advance `date` to the first date >= start
        while (date.isBefore(start)) {
            date = date.plusDays(frequency);
        }

        LocalDate lastGenerated = plan.getLastGeneratedDate();

        while (!date.isAfter(endBoundary)) {
            // Skip if task already exists for this date
            if (!taskRepository.existsByRecurringPlan_IdAndScheduledDate(plan.getId(), date)) {
                Task task = new Task();
                task.setType(TaskType.SANITIZATION);
                task.setStatus(TaskStatus.NEW);
                task.setAddress(plan.getSanitationLocationAddress());
                task.setCoordinates(plan.getSanitationLocationCoordinates());
                task.setClientName(clientName);
                task.setClientPhone(clientPhone);
                task.setContactPerson(plan.getContact());
                task.setInternalNotes(plan.getDetails());
                task.setProductName(plan.getSubscription() != null ? plan.getSubscription().getName() : null);
                task.setScheduledDate(date);
                task.setScheduledTime(date.atStartOfDay());
                task.setRoute(plan.getRoute());
                task.setRecurringPlan(plan);

                taskRepository.save(task);
            }

            lastGenerated = date;
            date = date.plusDays(frequency);
        }

        // Update the tracking field
        if (lastGenerated != null) {
            plan.setLastGeneratedDate(lastGenerated);
            recurringRepo.save(plan);
        }
    }
}
