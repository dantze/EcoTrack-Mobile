package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    private static final Logger log = LoggerFactory.getLogger(TaskService.class);

    private final TaskRepository taskRepository;
    private final OrderRepository orderRepository;
    private final RouteRepository routeRepository;
    private final RecurringIgienizareService recurringIgienizareService;

    public TaskService(TaskRepository taskRepository, OrderRepository orderRepository,
            RouteRepository routeRepository, RecurringIgienizareService recurringIgienizareService) {
        this.taskRepository = taskRepository;
        this.orderRepository = orderRepository;
        this.routeRepository = routeRepository;
        this.recurringIgienizareService = recurringIgienizareService;
    }

    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task-ul nu a fost găsit"));
    }

    public List<Task> getTasksByRouteId(Long routeId) {
        return taskRepository.findByRoute_IdOrderByOrderIndexAsc(routeId);
    }

    public List<Task> getTasksByRouteAndDate(Long routeId, LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();
        return taskRepository.findByRouteAndDay(routeId, date, startOfDay, endOfDay);
    }

    /**
     * Get all tasks for an employee on a specific scheduled date
     */
    public List<Task> getTasksByEmployeeAndDate(Long employeeId, LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();
        return taskRepository.findByEmployeeAndScheduledDate(employeeId, startOfDay, endOfDay);
    }

    /**
     * Get all tasks belonging to an employee (via route), regardless of date
     */
    public List<Task> getTasksByEmployee(Long employeeId) {
        return taskRepository.findByRoute_Employee_IdOrderByOrderIndexAsc(employeeId);
    }

    public Task createTask(Task task) {
        return taskRepository.save(task);
    }

    public Task updateTaskStatus(Long taskId, TaskStatus status) {
        Task task = getTaskById(taskId);
        task.setStatus(status);
        return taskRepository.save(task);
    }

    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
    }

    /**
     * Creates a Task from an Order and assigns it to a Route
     */
    @Transactional
    public Task createTaskFromOrder(Long orderId, Long routeId) {
        // Check if task already exists for this order
        if (taskRepository.existsByOrder_Id(orderId)) {
            throw new IllegalStateException("Această comandă are deja un task asociat");
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Comanda nu a fost găsită"));

        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta nu a fost găsită"));

        // Determine task type based on order type
        TaskType taskType = mapOrderTypeToTaskType(order.getOrderType());

        // --- Build address & coordinates based on order subtype ---
        String address = null;
        String coordinates = null;
        Integer quantity = null;

        // Each subtype keeps its location under a different pair of field names,
        // but the rule is the same for all three: prefer the typed address, fall
        // back to the raw coordinates so the driver still has something to
        // navigate to.
        if (order instanceof AmplasareOrder amp) {
            coordinates = amp.getLocationCoordinates();
            address = firstNonEmpty(amp.getLocationAddress(), coordinates);
            quantity = amp.getQuantity();
        } else if (order instanceof RidicareOrder rid) {
            coordinates = rid.getPickupLocationCoordinates();
            address = firstNonEmpty(rid.getPickupLocationAddress(), coordinates);
            quantity = rid.getPickupQuantity();
        } else if (order instanceof IgienizareOrder igi) {
            coordinates = igi.getSanitationLocationCoordinates();
            address = firstNonEmpty(igi.getSanitationLocationAddress(), coordinates);
        }

        // Final fallback: use client address if still null
        if (address == null && order.getClient() != null && order.getClient().getAddress() != null) {
            address = order.getClient().getAddress();
        }

        // --- Build client info ---
        String clientName = "Client necunoscut";
        String clientPhone = null;

        if (order.getClient() != null) {
            Client client = order.getClient();
            if (client instanceof Company) {
                clientName = ((Company) client).getName();
            } else if (client instanceof Individual) {
                clientName = ((Individual) client).getFullName();
            }
            clientPhone = client.getPhone();
        }

        // --- Build product info from the correct subtype ---
        String productName = null;
        if (order instanceof AmplasareOrder amp && amp.getProduct() != null) {
            productName = amp.getProduct().getName();
        } else if (order instanceof RidicareOrder rid && rid.getProduct() != null) {
            productName = rid.getProduct().getName();
        } else if (order instanceof IgienizareOrder igi && igi.getSubscription() != null) {
            productName = igi.getSubscription().getName(); // subscription name as the "product"
        }

        // Create the task with all order data
        Task task = new Task();
        task.setType(taskType);
        task.setStatus(TaskStatus.NEW);
        task.setAddress(address);
        task.setCoordinates(coordinates);
        task.setClientName(clientName);
        task.setClientPhone(clientPhone);
        task.setContactPerson(order.getContact());
        task.setProductName(productName);
        task.setQuantity(quantity);
        task.setInternalNotes(order.getDetails());
        // scheduledTime left null - will be set explicitly by the user
        task.setRoute(route);
        task.setOrder(order);

        Task savedTask = taskRepository.save(task);

        // If this order belongs to a recurring plan, assign the route and generate recurring tasks
        if (order instanceof IgienizareOrder igi && igi.getRecurringPlan() != null) {
            try {
                recurringIgienizareService.assignRoute(igi.getRecurringPlan().getId(), routeId);
            } catch (RuntimeException e) {
                log.warn("Warning: could not generate recurring tasks: {}", e.getMessage());
            }
        }

        return savedTask;
    }

    /**
     * Every task generated from an order, oldest first.
     */
    public List<Task> getTasksByOrderId(Long orderId) {
        return taskRepository.findAllByOrder_IdOrderByIdAsc(orderId);
    }

    /**
     * The one task that answers "is this order's work finished?" (TODO-34).
     *
     * <p>An order can carry more than one task, so "the order's status" has to
     * be a roll-up rather than whichever row came back first. The rule is the
     * one {@code OrderRepository.findLiveBySubscriptionId} enforces in JPQL and
     * {@code isOrderFulfilled} enforces in the web app: <b>an order is finished
     * iff ANY of its tasks is COMPLETED</b>. So a COMPLETED task wins whenever
     * one exists, whatever the others say.
     *
     * <p>With none completed the answer is unfinished either way, and the task
     * returned is only there to describe the work still outstanding — the
     * earliest scheduled one, which is what an operator looks at next. Ties and
     * unscheduled tasks fall back to the list's order (id ascending), so the
     * same order always summarises to the same task.
     *
     * <p>Changing this rule means changing the JPQL and the web function too;
     * {@code shared/fulfilment-cases.json} is the fixture that holds all three
     * to the same answers.
     */
    public static Optional<Task> summariseOrderTasks(List<Task> tasks) {
        return tasks.stream()
                .filter(task -> task.getStatus() == TaskStatus.COMPLETED)
                .findFirst()
                .or(() -> tasks.stream()
                        .min(Comparator.comparing(Task::getScheduledTime,
                                Comparator.nullsLast(Comparator.naturalOrder()))));
    }

    /**
     * Reassign a task to a different route
     */
    @Transactional
    public Task reassignTask(Long taskId, Long newRouteId) {
        Task task = getTaskById(taskId);
        Route newRoute = routeRepository.findById(newRouteId)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta nu a fost găsită"));

        task.setRoute(newRoute);
        return taskRepository.save(task);
    }

    /**
     * Reassign multiple tasks to a different route
     */
    @Transactional
    public List<Task> reassignTasks(List<Long> taskIds, Long newRouteId) {
        Route newRoute = routeRepository.findById(newRouteId)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta nu a fost găsită"));

        List<Task> tasks = taskRepository.findAllById(taskIds);
        tasks.forEach(task -> task.setRoute(newRoute));

        return taskRepository.saveAll(tasks);
    }

    /** Null when neither candidate carries anything, matching "no address known". */
    private static String firstNonEmpty(String preferred, String fallback) {
        if (preferred != null && !preferred.isEmpty()) {
            return preferred;
        }
        return fallback != null && !fallback.isEmpty() ? fallback : null;
    }

    private TaskType mapOrderTypeToTaskType(String orderType) {
        if (orderType == null)
            return TaskType.PLACEMENT;

        switch (orderType.toLowerCase()) {
            case "amplasari":
            case "amplasare":
                return TaskType.PLACEMENT;
            case "ridicari":
            case "ridicare":
                return TaskType.PICKUP;
            case "igienizari":
            case "igienizare":
                return TaskType.SANITIZATION;
            default:
                return TaskType.PLACEMENT;
        }
    }
}
