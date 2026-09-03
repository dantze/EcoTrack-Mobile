package com.example.damiProd.SecurityTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.service.TokenService;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
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
@AutoConfigureTestDatabase
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
    @Autowired private OrderRepository orderRepository;
    @Autowired private ObjectMapper objectMapper;

    private Employee driverA;
    private Employee driverB;
    private Task taskA;
    private Task taskB;
    private IgienizareOrder orderOfDriverA;
    /** A second order, so the batch read (TODO-52) has more than one id to leak. */
    private IgienizareOrder orderOfDriverB;
    private String tokenA;
    private String tokenSales;

    @BeforeEach
    void setUp() throws Exception {
        driverA = seed("scope_driver_a", "DRIVER");
        driverB = seed("scope_driver_b", "DRIVER");
        Employee sales = seed("scope_sales", "SALES");

        taskA = seedTaskFor(driverA, "Client A");
        orderOfDriverA = seedOrderFor(taskA);
        taskB = seedTaskFor(driverB, "Client B");
        orderOfDriverB = seedOrderFor(taskB);

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

    // ------------------------------------------- the order-shaped read (TODO-42)

    // GET /api/tasks/order/{id}/exists names the task's id, route, schedule and
    // status. The role matrix lets any authenticated employee read /api/**, so
    // before the guard a driver could walk the order id space and read work that
    // is not theirs - the same leak /api/tasks/employee/{id} had.

    @Test
    void driver_cannotProbeOrderTaskStatus_evenForOwnTask() throws Exception {
        // The strongest case for OFFICE-ONLY rather than a row-scoped rule: this
        // order carries driver A's own task and driver A still gets 403, because
        // no driver screen asks this question in the first place.
        mockMvc.perform(get("/api/tasks/order/" + orderOfDriverA.getId() + "/exists")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_cannotProbeOrderTaskStatus_forAnUnknownOrderId() throws Exception {
        // The guard runs BEFORE the lookup, so a refused probe cannot be told
        // apart from a missing order - a driver learns nothing by scanning ids.
        mockMvc.perform(get("/api/tasks/order/999999/exists")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void officeStaff_stillReadOrderTaskStatus() throws Exception {
        mockMvc.perform(get("/api/tasks/order/" + orderOfDriverA.getId() + "/exists")
                        .header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasTask").value(true))
                .andExpect(jsonPath("$.taskId").value(taskA.getId()));
    }

    // ------------------------------------------- the BATCH order read (TODO-52)

    // GET /api/tasks/order-status?ids=... answers the same question for many
    // orders at once, so it inherits the same answer. Unguarded it would be
    // strictly WORSE than the leak above: one request enumerates the order space
    // instead of probing a single id.

    @Test
    void driver_cannotProbeBatchOrderTaskStatus() throws Exception {
        mockMvc.perform(get("/api/tasks/order-status")
                        .param("ids", orderOfDriverA.getId() + "," + orderOfDriverB.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void driver_cannotProbeBatchOrderTaskStatus_evenForOwnOrderAlone() throws Exception {
        // Same reasoning as the single-id case: office-only, not row-scoped,
        // because no driver screen asks this question at all.
        mockMvc.perform(get("/api/tasks/order-status")
                        .param("ids", String.valueOf(orderOfDriverA.getId()))
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
    }

    @Test
    void officeStaff_readBatchOrderTaskStatus() throws Exception {
        mockMvc.perform(get("/api/tasks/order-status")
                        .param("ids", orderOfDriverA.getId() + "," + orderOfDriverB.getId())
                        .header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.['" + orderOfDriverA.getId() + "'].hasTask").value(true))
                .andExpect(jsonPath("$.['" + orderOfDriverA.getId() + "'].taskId").value(taskA.getId()))
                .andExpect(jsonPath("$.['" + orderOfDriverB.getId() + "'].taskId").value(taskB.getId()));
    }

    @Test
    void batchOrderTaskStatus_reportsAnOrderWithNoTaskRatherThanOmittingIt() throws Exception {
        // A missing entry would read as "no task" anyway, but only by accident.
        // Comenzi decides Curente vs Arhivă from this, so every requested id
        // must come back with an explicit answer.
        mockMvc.perform(get("/api/tasks/order-status")
                        .param("ids", orderOfDriverA.getId() + ",999999")
                        .header("Authorization", "Bearer " + tokenSales))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.['999999'].hasTask").value(false))
                .andExpect(jsonPath("$.['999999'].status").doesNotExist());
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

    /** An order carrying {@code task}, so the order-shaped read has something to find. */
    private IgienizareOrder seedOrderFor(Task task) {
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setNumber(4242L);
        order.setSanitationDate(LocalDate.now().toString());
        IgienizareOrder saved = orderRepository.save(order);
        task.setOrder(saved);
        taskRepository.save(task);
        return saved;
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
