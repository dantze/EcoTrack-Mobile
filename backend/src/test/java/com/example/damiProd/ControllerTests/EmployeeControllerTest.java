package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.EmployeeController;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.service.EmployeeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EmployeeController.class)
// Security filters are disabled in this slice: this test targets controller/service
// wiring, not auth. @WebMvcTest does not pick up the app's own SecurityConfig, so
// without this the default Spring Boot Security auto-config would 401 everything.
@AutoConfigureMockMvc(addFilters = false)
class EmployeeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmployeeService employeeService;

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------
    private Employee buildDriver() {
        Employee driver = new Employee("sofer1", "Ion Șofer", "0711000000");
        driver.setId(1L);
        driver.setCounty("Cluj");

        EmployeeRole driverRole = new EmployeeRole("DRIVER");
        driverRole.setId(1L);
        driver.setRoles(Set.of(driverRole));
        return driver;
    }

    private Employee buildSalesEmployee() {
        Employee sales = new Employee("vanzator1", "Maria Vânzări", "0722111222");
        sales.setId(2L);
        sales.setCounty("București");

        EmployeeRole salesRole = new EmployeeRole("SALES");
        salesRole.setId(2L);
        sales.setRoles(Set.of(salesRole));
        return sales;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — GET /api/employees → all employees
    // -----------------------------------------------------------------------
    @Test
    void getAllEmployees_shouldReturn200() throws Exception {
        when(employeeService.getAllEmployees()).thenReturn(List.of(buildDriver(), buildSalesEmployee()));

        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fullName").value("Ion Șofer"))
                .andExpect(jsonPath("$[1].fullName").value("Maria Vânzări"));
    }

    // -----------------------------------------------------------------------
    // TEST 2 — GET /api/employees/{id} → get by ID (found)
    // -----------------------------------------------------------------------
    @Test
    void getEmployeeById_shouldReturn200WhenFound() throws Exception {
        when(employeeService.getEmployeeById(1L)).thenReturn(Optional.of(buildDriver()));

        mockMvc.perform(get("/api/employees/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("sofer1"));
    }

    // -----------------------------------------------------------------------
    // TEST 3 — GET /api/employees/{id} → 404 when not found
    // -----------------------------------------------------------------------
    @Test
    void getEmployeeById_shouldReturn404WhenNotFound() throws Exception {
        when(employeeService.getEmployeeById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/employees/999"))
                .andExpect(status().isNotFound());
    }

    // -----------------------------------------------------------------------
    // TEST 4 — GET /api/employees/drivers → only drivers
    // -----------------------------------------------------------------------
    @Test
    void getAllDrivers_shouldReturn200() throws Exception {
        when(employeeService.getAllDrivers()).thenReturn(List.of(buildDriver()));

        mockMvc.perform(get("/api/employees/drivers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fullName").value("Ion Șofer"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    // -----------------------------------------------------------------------
    // TEST 5 — GET /api/employees/role/{roleName} → filter by role
    // -----------------------------------------------------------------------
    @Test
    void getEmployeesByRole_shouldReturn200() throws Exception {
        when(employeeService.getEmployeesByRole("SALES")).thenReturn(List.of(buildSalesEmployee()));

        mockMvc.perform(get("/api/employees/role/SALES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fullName").value("Maria Vânzări"));
    }

    // -----------------------------------------------------------------------
    // TEST 6 — POST /api/employees is gone → 405, and nothing is written
    // -----------------------------------------------------------------------
    // It used to bind the raw Employee entity, so the request body could carry
    // its own `roles` (mint an ADMIN) and its `password` was persisted as sent,
    // unhashed. Writes belong to /api/admin/employees. See EmployeeController.
    @Test
    void createEmployee_isNoLongerExposed() throws Exception {
        String body = """
                {
                    "username": "sofer1",
                    "password": "pass123",
                    "fullName": "Ion Șofer",
                    "roles": [{"roleName": "ADMIN"}]
                }
                """;

        mockMvc.perform(post("/api/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isMethodNotAllowed());

        verifyNoInteractions(employeeService);
    }

    // -----------------------------------------------------------------------
    // TEST 7 — DELETE /api/employees/{id} is gone → 405, and nothing is deleted
    // -----------------------------------------------------------------------
    @Test
    void deleteEmployee_isNoLongerExposed() throws Exception {
        mockMvc.perform(delete("/api/employees/1"))
                .andExpect(status().isMethodNotAllowed());

        verifyNoInteractions(employeeService);
    }
}
