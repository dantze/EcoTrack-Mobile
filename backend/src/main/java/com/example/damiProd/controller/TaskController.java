package com.example.damiProd.controller;

import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskPhoto;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.repository.TaskPhotoRepository;
import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.service.PhotoService;
import com.example.damiProd.service.TaskAccessPolicy;
import com.example.damiProd.service.TaskService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    private static final Logger log = LoggerFactory.getLogger(TaskController.class);

    private final TaskService taskService;
    private final PhotoService photoService;
    private final TaskPhotoRepository taskPhotoRepository;
    private final TaskAccessPolicy accessPolicy;

    public TaskController(TaskService taskService, PhotoService photoService,
            TaskPhotoRepository taskPhotoRepository, TaskAccessPolicy accessPolicy) {
        this.taskService = taskService;
        this.photoService = photoService;
        this.taskPhotoRepository = taskPhotoRepository;
        this.accessPolicy = accessPolicy;
    }

    // -------------------------------------------------------------------
    // The driver app's entry point.
    // -------------------------------------------------------------------
    // Takes the employee from the ACCESS TOKEN, never from the URL, so there is
    // no id for a caller to swap. /tasks/employee/{id} below still exists for
    // the office overview and is guarded separately.
    @GetMapping("/mine")
    public ResponseEntity<List<Task>> getMyTasks(@AuthenticationPrincipal EmployeePrincipal principal) {
        Long self = accessPolicy.callerId(principal);
        if (self == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(taskService.getTasksByEmployee(self));
    }

    @GetMapping("/mine/date/{date}")
    public ResponseEntity<List<Task>> getMyTasksByDate(
            @AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable String date) {
        Long self = accessPolicy.callerId(principal);
        if (self == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(taskService.getTasksByEmployeeAndDate(self, LocalDate.parse(date)));
    }

    // Get all tasks
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks(@AuthenticationPrincipal EmployeePrincipal principal) {
        accessPolicy.requireOfficeRole(principal);
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    // Get a specific task by ID
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long id) {
        Task task = taskService.getTaskById(id);
        accessPolicy.requireCanAccessTask(principal, task);
        return ResponseEntity.ok(task);
    }

    // Get all tasks for a specific route
    @GetMapping("/route/{routeId}")
    public ResponseEntity<List<Task>> getTasksByRoute(@AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long routeId) {
        accessPolicy.requireOfficeRole(principal);
        List<Task> tasks = taskService.getTasksByRouteId(routeId);
        return ResponseEntity.ok(tasks);
    }

    // Get tasks for a specific route on a specific date
    @GetMapping("/route/{routeId}/date/{date}")
    public ResponseEntity<List<Task>> getTasksByRouteAndDate(
            @AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long routeId,
            @PathVariable String date) {
        accessPolicy.requireOfficeRole(principal);
        LocalDate localDate = LocalDate.parse(date);
        List<Task> tasks = taskService.getTasksByRouteAndDate(routeId, localDate);
        return ResponseEntity.ok(tasks);
    }

    // Get tasks by employee and scheduled date
    @GetMapping("/employee/{employeeId}/date/{date}")
    public ResponseEntity<List<Task>> getTasksByEmployeeAndDate(
            @AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long employeeId,
            @PathVariable String date) {
        accessPolicy.requireCanReadTasksOf(principal, employeeId);
        LocalDate localDate = LocalDate.parse(date);
        List<Task> tasks = taskService.getTasksByEmployeeAndDate(employeeId, localDate);
        return ResponseEntity.ok(tasks);
    }

    // Get all tasks for an employee (regardless of date)
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<Task>> getTasksByEmployee(@AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long employeeId) {
        accessPolicy.requireCanReadTasksOf(principal, employeeId);
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
            @AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, String> statusUpdate) {

        // A driver may only advance a task on their OWN route. Without this a
        // driver could complete anyone's task by guessing an id.
        accessPolicy.requireCanAccessTask(principal, taskService.getTaskById(id));

        String statusStr = statusUpdate.get("status");
        if (statusStr == null || statusStr.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        TaskStatus status;
        try {
            status = TaskStatus.valueOf(statusStr.trim());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
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
            @AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files) {

        Task task = taskService.getTaskById(id);
        // Second of the two driver writes - same rule as status.
        accessPolicy.requireCanAccessTask(principal, task);
        List<String> uploadedUrls = new ArrayList<>();

        if (files == null || files.isEmpty()) {
            return ResponseEntity.ok(Map.of("uploaded", 0, "urls", List.of()));
        }

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

            String contentType = file.getContentType();
            if (contentType != null && !PhotoService.ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
                log.warn("Skipping file upload for task {} with disallowed content type: {}", id, contentType);
                continue;
            }

            try {
                // Simple incrementing filename: 1, 2, 3...
                String customFileName = String.valueOf(startIndex + uploadedUrls.size());
                String publicUrl = photoService.uploadPhoto(file, folderName, customFileName);

                // Save reference in database
                TaskPhoto taskPhoto = new TaskPhoto(publicUrl, null, task);
                taskPhotoRepository.save(taskPhoto);
                uploadedUrls.add(publicUrl);
            } catch (Exception e) {
                log.error("Failed to upload task photo for task ID {}", id, e);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("uploaded", uploadedUrls.size());
        response.put("urls", uploadedUrls);
        return ResponseEntity.ok(response);
    }

    // Get all photo URLs for a task
    @GetMapping("/{id}/photos")
    public ResponseEntity<List<String>> getTaskPhotos(@AuthenticationPrincipal EmployeePrincipal principal,
            @PathVariable Long id) {
        // Photos are evidence of a job: same visibility rule as the task itself.
        accessPolicy.requireCanAccessTask(principal, taskService.getTaskById(id));
        List<TaskPhoto> photos = taskPhotoRepository.findByTaskId(id);
        List<String> urls = photos.stream().map(TaskPhoto::getImageUrl).toList();
        return ResponseEntity.ok(urls);
    }
}
