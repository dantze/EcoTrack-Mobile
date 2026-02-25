package com.example.damiProd.controller;

import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskPhoto;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.repository.TaskPhotoRepository;
import com.example.damiProd.service.PhotoService;
import com.example.damiProd.service.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final PhotoService photoService;
    private final TaskPhotoRepository taskPhotoRepository;

    public TaskController(TaskService taskService, PhotoService photoService, TaskPhotoRepository taskPhotoRepository) {
        this.taskService = taskService;
        this.photoService = photoService;
        this.taskPhotoRepository = taskPhotoRepository;
    }

    // Get all tasks
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks() {
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    // Get a specific task by ID
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        Task task = taskService.getTaskById(id);
        return ResponseEntity.ok(task);
    }

    // Get all tasks for a specific route
    @GetMapping("/route/{routeId}")
    public ResponseEntity<List<Task>> getTasksByRoute(@PathVariable Long routeId) {
        List<Task> tasks = taskService.getTasksByRouteId(routeId);
        return ResponseEntity.ok(tasks);
    }

    // Get tasks by employee and scheduled date
    @GetMapping("/employee/{employeeId}/date/{date}")
    public ResponseEntity<List<Task>> getTasksByEmployeeAndDate(
            @PathVariable Long employeeId,
            @PathVariable String date) {
        LocalDate localDate = LocalDate.parse(date);
        List<Task> tasks = taskService.getTasksByEmployeeAndDate(employeeId, localDate);
        return ResponseEntity.ok(tasks);
    }

    // Get all tasks for an employee (regardless of date)
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<Task>> getTasksByEmployee(@PathVariable Long employeeId) {
        List<Task> tasks = taskService.getTasksByEmployee(employeeId);
        return ResponseEntity.ok(tasks);
    }

    // Create a new task
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        Task savedTask = taskService.createTask(task);
        return ResponseEntity.ok(savedTask);
    }

    // Create a task from an order and assign to a route
    @PostMapping("/from-order")
    public ResponseEntity<Task> createTaskFromOrder(@RequestBody Map<String, Long> request) {
        Long orderId = request.get("orderId");
        Long routeId = request.get("routeId");

        if (orderId == null || routeId == null) {
            return ResponseEntity.badRequest().build();
        }

        Task task = taskService.createTaskFromOrder(orderId, routeId);
        return ResponseEntity.ok(task);
    }

    // Check if an order has an associated task
    @GetMapping("/order/{orderId}/exists")
    public ResponseEntity<Map<String, Object>> checkOrderHasTask(@PathVariable Long orderId) {
        boolean hasTask = taskService.orderHasTask(orderId);
        Task task = null;
        if (hasTask) {
            task = taskService.getTaskByOrderId(orderId).orElse(null);
        }
        Map<String, Object> response = new HashMap<>();
        response.put("hasTask", hasTask);
        response.put("taskId", task != null ? task.getId() : null);
        response.put("routeId", task != null && task.getRouteId() != null ? task.getRouteId() : null);
        response.put("scheduledTime", task != null ? task.getScheduledTime() : null);
        response.put("status", task != null ? task.getStatus().name() : null);
        return ResponseEntity.ok(response);
    }

    // Update task status (for driver to mark task as IN_PROGRESS, COMPLETED, etc.)
    @PatchMapping("/{id}/status")
    public ResponseEntity<Task> updateTaskStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> statusUpdate) {

        String statusStr = statusUpdate.get("status");
        TaskStatus status = TaskStatus.valueOf(statusStr);
        Task updatedTask = taskService.updateTaskStatus(id, status);
        return ResponseEntity.ok(updatedTask);
    }

    // Update scheduled date for a task
    @PatchMapping("/{id}/scheduled-date")
    public ResponseEntity<Task> updateScheduledDate(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String dateStr = body.get("scheduledDate");
        if (dateStr == null || dateStr.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        LocalDate date = LocalDate.parse(dateStr);
        LocalDateTime dateTime = date.atTime(LocalTime.of(8, 0)); // Default to 8:00 AM

        Task task = taskService.getTaskById(id);
        task.setScheduledTime(dateTime);
        Task updatedTask = taskService.createTask(task); // save
        return ResponseEntity.ok(updatedTask);
    }

    // Delete a task
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    // Reassign a single task to a different route
    @PutMapping("/{id}/reassign/{newRouteId}")
    public ResponseEntity<Task> reassignTask(
            @PathVariable Long id,
            @PathVariable Long newRouteId) {
        Task updatedTask = taskService.reassignTask(id, newRouteId);
        return ResponseEntity.ok(updatedTask);
    }

    // Reassign multiple tasks to a different route
    @PutMapping("/reassign")
    public ResponseEntity<List<Task>> reassignTasks(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Integer> taskIdInts = (List<Integer>) request.get("taskIds");
        List<Long> taskIds = taskIdInts.stream().map(Integer::longValue).toList();
        Long newRouteId = ((Number) request.get("newRouteId")).longValue();

        List<Task> updatedTasks = taskService.reassignTasks(taskIds, newRouteId);
        return ResponseEntity.ok(updatedTasks);
    }

    // Upload photos for a task (stored in DO Spaces under "poze
    // cabine/{taskId}_{clientName}/" folder)
    @PostMapping("/{id}/photos")
    public ResponseEntity<Map<String, Object>> uploadTaskPhotos(
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files) {

        Task task = taskService.getTaskById(id);
        List<String> uploadedUrls = new ArrayList<>();

        // Build folder name: "poze cabine/{taskId}_{clientName}"
        String clientName = task.getClientName() != null ? task.getClientName() : "unknown";
        String sanitizedClientName = clientName.replaceAll("[^a-zA-Z0-9\\p{L}]", "_");
        String folderName = "poze cabine/" + id + "_" + sanitizedClientName;

        // Count existing photos for this task to continue numbering
        List<TaskPhoto> existingPhotos = taskPhotoRepository.findByTaskId(id);
        int startIndex = existingPhotos.size() + 1;

        for (int i = 0; i < files.size(); i++) {
            MultipartFile file = files.get(i);
            if (file.isEmpty())
                continue;

            try {
                // Simple incrementing filename: 1, 2, 3...
                String customFileName = String.valueOf(startIndex + i);
                String publicUrl = photoService.uploadPhoto(file, folderName, customFileName);

                // Save reference in database
                TaskPhoto taskPhoto = new TaskPhoto(publicUrl, null, task);
                taskPhotoRepository.save(taskPhoto);
                uploadedUrls.add(publicUrl);
            } catch (Exception e) {
                System.err.println("Failed to upload task photo: " + e.getMessage());
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("uploaded", uploadedUrls.size());
        response.put("urls", uploadedUrls);
        return ResponseEntity.ok(response);
    }

    // Get all photo URLs for a task
    @GetMapping("/{id}/photos")
    public ResponseEntity<List<String>> getTaskPhotos(@PathVariable Long id) {
        List<TaskPhoto> photos = taskPhotoRepository.findByTaskId(id);
        List<String> urls = photos.stream().map(TaskPhoto::getImageUrl).toList();
        return ResponseEntity.ok(urls);
    }
}
