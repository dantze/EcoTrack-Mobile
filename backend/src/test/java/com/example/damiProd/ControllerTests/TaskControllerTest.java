package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.TaskController;
import com.example.damiProd.domain.*;
import com.example.damiProd.repository.TaskPhotoRepository;
import com.example.damiProd.service.PhotoService;
import com.example.damiProd.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private TaskService taskService;
    @MockitoBean private PhotoService photoService;
    @MockitoBean private TaskPhotoRepository taskPhotoRepository;

    // -----------------------------------------------------------------------
    // Helper — builds a sample Task
    // -----------------------------------------------------------------------
    private Task buildSampleTask() {
        Route route = new Route();
        route.setId(20L);

        Task task = new Task(TaskType.PLACEMENT, LocalDateTime.of(2025, 7, 1, 8, 0),
                "Str. Exemplu 5, Cluj", "Ion Popescu");
        task.setId(1L);
        task.setStatus(TaskStatus.NEW);
        task.setClientPhone("0711222333");
        task.setProductName("Toaletă Standard");
        task.setQuantity(2);
        task.setRoute(route);
        return task;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — GET /api/tasks → get all tasks
    // -----------------------------------------------------------------------
    @Test
    void getAllTasks_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        when(taskService.getAllTasks()).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].type").value("PLACEMENT"));
    }

    // -----------------------------------------------------------------------
    // TEST 2 — GET /api/tasks/{id} → get task by ID
    // -----------------------------------------------------------------------
    @Test
    void getTaskById_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        when(taskService.getTaskById(1L)).thenReturn(task);

        mockMvc.perform(get("/api/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.clientName").value("Ion Popescu"));
    }

    // -----------------------------------------------------------------------
    // TEST 3 — GET /api/tasks/route/{routeId} → tasks by route
    // -----------------------------------------------------------------------
    @Test
    void getTasksByRoute_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        when(taskService.getTasksByRouteId(20L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks/route/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].routeId").value(20));
    }

    // -----------------------------------------------------------------------
    // TEST 4 — POST /api/tasks/from-order → create task from order
    // -----------------------------------------------------------------------
    @Test
    void createTaskFromOrder_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        when(taskService.createTaskFromOrder(10L, 20L)).thenReturn(task);

        String body = """
                { "orderId": 10, "routeId": 20 }
                """;

        mockMvc.perform(post("/api/tasks/from-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.type").value("PLACEMENT"));
    }

    // -----------------------------------------------------------------------
    // TEST 5 — POST /api/tasks/from-order missing params → 400
    // -----------------------------------------------------------------------
    @Test
    void createTaskFromOrder_missingParams_shouldReturn400() throws Exception {
        String body = """
                { "orderId": 10 }
                """;

        mockMvc.perform(post("/api/tasks/from-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // -----------------------------------------------------------------------
    // TEST 6 — GET /api/tasks/order/{orderId}/exists → check order has task
    // -----------------------------------------------------------------------
    @Test
    void checkOrderHasTask_shouldReturnTrue() throws Exception {
        Task task = buildSampleTask();
        when(taskService.orderHasTask(10L)).thenReturn(true);
        when(taskService.getTaskByOrderId(10L)).thenReturn(Optional.of(task));

        mockMvc.perform(get("/api/tasks/order/10/exists"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasTask").value(true))
                .andExpect(jsonPath("$.taskId").value(1))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    // -----------------------------------------------------------------------
    // TEST 7 — GET /api/tasks/order/{orderId}/exists → no task
    // -----------------------------------------------------------------------
    @Test
    void checkOrderHasTask_shouldReturnFalse() throws Exception {
        when(taskService.orderHasTask(99L)).thenReturn(false);

        mockMvc.perform(get("/api/tasks/order/99/exists"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasTask").value(false))
                .andExpect(jsonPath("$.taskId").isEmpty());
    }

    // -----------------------------------------------------------------------
    // TEST 8 — PATCH /api/tasks/{id}/status → update status
    // -----------------------------------------------------------------------
    @Test
    void updateTaskStatus_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        task.setStatus(TaskStatus.IN_PROGRESS);
        when(taskService.updateTaskStatus(1L, TaskStatus.IN_PROGRESS)).thenReturn(task);

        String body = """
                { "status": "IN_PROGRESS" }
                """;

        mockMvc.perform(patch("/api/tasks/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    // -----------------------------------------------------------------------
    // TEST 9 — DELETE /api/tasks/{id} → delete task
    // -----------------------------------------------------------------------
    @Test
    void deleteTask_shouldReturn204() throws Exception {
        doNothing().when(taskService).deleteTask(1L);

        mockMvc.perform(delete("/api/tasks/1"))
                .andExpect(status().isNoContent());

        verify(taskService).deleteTask(1L);
    }

    // -----------------------------------------------------------------------
    // TEST 10 — PUT /api/tasks/{id}/reassign/{newRouteId} → reassign task
    // -----------------------------------------------------------------------
    @Test
    void reassignTask_shouldReturn200() throws Exception {
        Route newRoute = new Route();
        newRoute.setId(30L);

        Task task = buildSampleTask();
        task.setRoute(newRoute);

        when(taskService.reassignTask(1L, 30L)).thenReturn(task);

        mockMvc.perform(put("/api/tasks/1/reassign/30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.routeId").value(30));
    }

    // -----------------------------------------------------------------------
    // TEST 11 — GET /api/tasks/{id}/photos → get task photos
    // -----------------------------------------------------------------------
    @Test
    void getTaskPhotos_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        TaskPhoto photo1 = new TaskPhoto("https://cdn.example.com/photo1.jpg", null, task);
        TaskPhoto photo2 = new TaskPhoto("https://cdn.example.com/photo2.jpg", null, task);

        when(taskPhotoRepository.findByTaskId(1L)).thenReturn(List.of(photo1, photo2));

        mockMvc.perform(get("/api/tasks/1/photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("https://cdn.example.com/photo1.jpg"))
                .andExpect(jsonPath("$[1]").value("https://cdn.example.com/photo2.jpg"));
    }

    // -----------------------------------------------------------------------
    // TEST 12 — GET /api/tasks/employee/{employeeId} → tasks by employee
    // -----------------------------------------------------------------------
    @Test
    void getTasksByEmployee_shouldReturn200() throws Exception {
        Task task = buildSampleTask();
        when(taskService.getTasksByEmployee(99L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks/employee/99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }
}
