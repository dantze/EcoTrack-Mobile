package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final OrderRepository orderRepository;
    private final RouteRepository routeRepository;

    public TaskService(TaskRepository taskRepository, OrderRepository orderRepository,
            RouteRepository routeRepository) {
        this.taskRepository = taskRepository;
        this.orderRepository = orderRepository;
        this.routeRepository = routeRepository;
    }

    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task-ul nu a fost găsit"));
    }

    public List<Task> getTasksByRouteId(Long routeId) {
        return taskRepository.findByRoute_Id(routeId);
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

        // Get client info
        String clientName = "Client necunoscut";
        String clientPhone = null;
        String address = order.getLocationCoordinates();

        if (order.getClient() != null) {
            Client client = order.getClient();
            if (client instanceof Company) {
                clientName = ((Company) client).getName();
            } else if (client instanceof Individual) {
                clientName = ((Individual) client).getFullName();
            }
            clientPhone = client.getPhone();
            if (client.getAddress() != null && !client.getAddress().isEmpty()) {
                address = client.getAddress();
            }
        }

        // Create the task
        Task task = new Task();
        task.setType(taskType);
        task.setStatus(TaskStatus.NEW);
        task.setClientName(clientName);
        task.setClientPhone(clientPhone);
        task.setAddress(address);
        task.setInternalNotes(order.getDetails());
        task.setScheduledTime(LocalDateTime.now());
        task.setRoute(route);
        task.setOrder(order);

        return taskRepository.save(task);
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
