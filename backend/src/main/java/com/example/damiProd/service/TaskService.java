package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

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
                .orElseThrow(() -> new RuntimeException("Task-ul nu a fost găsit"));
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
            throw new RuntimeException("Această comandă are deja un task asociat");
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Comanda nu a fost găsită"));

        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));

        // Determine task type based on order type
        TaskType taskType = mapOrderTypeToTaskType(order.getOrderType());

        // --- Build address & coordinates based on order subtype ---
        String address = null;
        String coordinates = null;
        Integer quantity = null;

        if (order instanceof AmplasareOrder amp) {
            coordinates = amp.getLocationCoordinates();
            if (amp.getLocationAddress() != null && !amp.getLocationAddress().isEmpty()) {
                address = amp.getLocationAddress();
            } else if (coordinates != null && !coordinates.isEmpty()) {
                address = coordinates;
            }
            quantity = amp.getQuantity();
        } else if (order instanceof RidicareOrder rid) {
            coordinates = rid.getPickupLocationCoordinates();
            if (rid.getPickupLocationAddress() != null && !rid.getPickupLocationAddress().isEmpty()) {
                address = rid.getPickupLocationAddress();
            } else if (coordinates != null && !coordinates.isEmpty()) {
                address = coordinates;
            }
            quantity = rid.getPickupQuantity();
        } else if (order instanceof IgienizareOrder igi) {
            coordinates = igi.getSanitationLocationCoordinates();
            if (igi.getSanitationLocationAddress() != null && !igi.getSanitationLocationAddress().isEmpty()) {
                address = igi.getSanitationLocationAddress();
            } else if (coordinates != null && !coordinates.isEmpty()) {
                address = coordinates;
            }
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
                System.err.println("Warning: could not generate recurring tasks: " + e.getMessage());
            }
        }

        return savedTask;
    }

    /**
     * Get task by order ID
     */
    public Optional<Task> getTaskByOrderId(Long orderId) {
        return taskRepository.findByOrder_Id(orderId);
    }

    /**
     * Check if order has an associated task
     */
    public boolean orderHasTask(Long orderId) {
        return taskRepository.existsByOrder_Id(orderId);
    }

    /**
     * Reassign a task to a different route
     */
    @Transactional
    public Task reassignTask(Long taskId, Long newRouteId) {
        Task task = getTaskById(taskId);
        Route newRoute = routeRepository.findById(newRouteId)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));

        task.setRoute(newRoute);
        return taskRepository.save(task);
    }

    /**
     * Reassign multiple tasks to a different route
     */
    @Transactional
    public List<Task> reassignTasks(List<Long> taskIds, Long newRouteId) {
        Route newRoute = routeRepository.findById(newRouteId)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));

        List<Task> tasks = taskRepository.findAllById(taskIds);
        tasks.forEach(task -> task.setRoute(newRoute));

        return taskRepository.saveAll(tasks);
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
