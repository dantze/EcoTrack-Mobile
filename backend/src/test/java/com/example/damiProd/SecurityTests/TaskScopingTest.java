package com.example.damiProd.SecurityTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.service.TokenService;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ROW-level access to tasks, as opposed to the VERB-level rules in
 * {@link AuthorizationMatrixTest}.
 *
 * The distinction is the whole point. The role matrix says "a DRIVER may PATCH
 * a task status"; it does not say WHICH task. Before TaskAccessPolicy existed,
 * a driver could read another driver's whole day with
 * GET /api/tasks/employee/{someoneElse}, or complete their tasks, just by
 * sending a different id - the server never checked the id was theirs.
 *
 * Assignment runs Task -> Route -> Employee: a route has one assignee, and a
 * driver owns exactly the tasks on their own routes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TaskScopingTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TokenService tokenService;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private EmployeeRoleRepository employeeRoleRepository;
    @Autowired private RouteRepository routeRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ObjectMapper objectMapper;

    private Employee driverA;
    private Employee driverB;
    private Task taskA;
    private Task taskB;
    private String tokenA;
    private String tokenSales;

    @BeforeEach
    void setUp() throws Exception {
        driverA = seed("scope_driver_a", "DRIVER");
        driverB = seed("scope_driver_b", "DRIVER");
        Employee sales = seed("scope_sales", "SALES");

        taskA = seedTaskFor(driverA, "Client A");
        taskB = seedTaskFor(driverB, "Client B");

        tokenA = mintToken(driverA);
        tokenSales = mintToken(sales);
    }

    // ---------------------------------------------------------------- reads

    @Test
    void driver_seesOnlyOwnTasks_viaMine() throws Exception {
        mockMvc.perform(get("/api/tasks/mine").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(taskA.getId()));
    }

    @Test
    void driver_cannotReadAnotherDriversTasks() throws Exception {
        mockMvc.perform(get("/api/tasks/employee/" + driverB.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_mayStillReadOwnTasksById() throws Exception {
        // Passing your OWN id is fine - the guard rejects only someone else's.
        mockMvc.perform(get("/api/tasks/employee/" + driverA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());
    }

    @Test
    void driver_cannotListAllTasks() throws Exception {
        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_cannotReadAnotherDriversTaskById() throws Exception {
        mockMvc.perform(get("/api/tasks/" + taskB.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_canReadOwnTaskById() throws Exception {
        mockMvc.perform(get("/api/tasks/" + taskA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());
    }

    // --------------------------------------------------------------- writes

    @Test
    void driver_cannotCompleteAnotherDriversTask() throws Exception {
        // The most damaging case: marking someone else's job done.
        mockMvc.perform(patch("/api/tasks/" + taskB.getId() + "/status")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_canCompleteOwnTask() throws Exception {
        mockMvc.perform(patch("/api/tasks/" + taskA.getId() + "/status")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void driver_cannotReadAnotherDriversTaskPhotos() throws Exception {
        mockMvc.perform(get("/api/tasks/" + taskB.getId() + "/photos")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    // --------------------------------------------------- office is unchanged

    @Test
    void officeStaff_keepFullOverview() throws Exception {
        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/employee/" + driverB.getId())
                        .header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/tasks/" + taskB.getId())
                        .header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------- helpers

    private Employee seed(String username, String roleName) {
        EmployeeRole role = employeeRoleRepository.findByRoleName(roleName)
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole(roleName)));
        return employeeRepository.findByUsername(username).orElseGet(() -> {
            Employee employee = new Employee(username, username, "0700000000");
            employee.setRoles(Set.of(role));
            return employeeRepository.save(employee);
        });
    }

    private Task seedTaskFor(Employee employee, String clientName) {
        Route route = routeRepository.save(
                new Route("Ruta " + employee.getUsername(), 2, "Cluj", employee));
        Task task = new Task(TaskType.SANITIZATION, LocalDateTime.now(), "Str. Test 1", clientName);
        task.setRoute(route);
        task.setScheduledDate(LocalDate.now());
        return taskRepository.save(task);
    }

    /**
     * Mints a session directly instead of POSTing credentials.
     *
     * There is no login endpoint any more - a session is only ever created by
     * an admin approving a device (see EnrollmentService). These tests are
     * about what a VALID token may then do, so they take the short path to one
     * rather than driving the whole enrollment flow; EnrollmentFlowTest covers
     * that end to end.
     */
    private String mintToken(Employee employee) {
        return tokenService.issueNewSession(employee, "test-device").accessToken();
    }
}
