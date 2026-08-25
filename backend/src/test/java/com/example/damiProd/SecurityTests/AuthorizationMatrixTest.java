package com.example.damiProd.SecurityTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Authorization (who may do what), as opposed to authentication (whether a
 * caller is anyone at all, which {@link AuthEnforcementOnTest} covers).
 *
 * Before this matrix existed, any valid token was effectively an admin token:
 * the only role rule in the whole app was /api/admin/**, so a DRIVER token
 * could create employees, delete clients or wipe routes.
 *
 * Probing "allowed" without side effects: an authorized request that then fails
 * on its *body* (400 from an unparseable payload, 415 from a non-multipart
 * upload) proves the request got past the filter chain, because authorization
 * runs before Spring MVC ever looks at the body. Any 401/403 means it did not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthorizationMatrixTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmployeeRoleRepository employeeRoleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private String driverToken;
    private String salesToken;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        seed("authz_driver", "driverpass", "DRIVER");
        seed("authz_sales", "salespass", "SALES");
        seed("authz_admin", "adminpass", "ADMIN");

        driverToken = login("authz_driver", "driverpass");
        salesToken = login("authz_sales", "salespass");
        adminToken = login("authz_admin", "adminpass");
    }

    private void seed(String username, String password, String roleName) {
        EmployeeRole role = employeeRoleRepository.findByRoleName(roleName)
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole(roleName)));
        if (employeeRepository.findByUsername(username).isEmpty()) {
            Employee employee = new Employee(username, passwordEncoder.encode(password), username, "0700000000");
            employee.setRoles(Set.of(role));
            employeeRepository.save(employee);
        }
    }

    private String login(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginBody(username, password));
        String json = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(json);
        return node.get("accessToken").asText();
    }

    record LoginBody(String username, String password) {
    }

    // ---------------------------------------------------------------------
    // Employee management is admin-only (it is the privilege-escalation path:
    // create an account, give it any role you like).
    // ---------------------------------------------------------------------

    @Test
    void driver_cannotCreateEmployees() throws Exception {
        mockMvc.perform(post("/api/employees")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void sales_cannotCreateOrDeleteEmployees() throws Exception {
        mockMvc.perform(post("/api/employees")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/employees/1")
                        .header("Authorization", "Bearer " + salesToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void sales_cannotReachAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/employees")
                        .header("Authorization", "Bearer " + salesToken))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------------
    // Business writes: office staff only.
    // ---------------------------------------------------------------------

    @Test
    void driver_cannotWriteBusinessData() throws Exception {
        mockMvc.perform(post("/api/clients")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/tasks/1")
                        .header("Authorization", "Bearer " + driverToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/tasks/1/scheduled-date")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void sales_mayWriteBusinessData() throws Exception {
        int status = mockMvc.perform(post("/api/clients")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("not-json"))
                .andReturn().getResponse().getStatus();

        // 400 (unreadable body) - i.e. it reached the MVC layer, which is all
        // this assertion is about.
        assertThat(status).isEqualTo(400);
    }

    // ---------------------------------------------------------------------
    // The two writes the driver app actually performs must keep working.
    // ---------------------------------------------------------------------

    @Test
    void driver_mayUpdateTaskStatus() throws Exception {
        int status = mockMvc.perform(patch("/api/tasks/1/status")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("not-json"))
                .andReturn().getResponse().getStatus();

        assertThat(status).isEqualTo(400);
    }

    @Test
    void driver_mayUploadTaskPhotos() throws Exception {
        // A multipart request with no "files" part: 400 from the missing part,
        // which only happens once authorization has already let it through.
        int status = mockMvc.perform(multipart("/api/tasks/1/photos")
                        .header("Authorization", "Bearer " + driverToken))
                .andReturn().getResponse().getStatus();

        assertThat(status).isEqualTo(400);
    }

    // ---------------------------------------------------------------------
    // Reads stay open to every signed-in employee, and everyone manages their
    // own sessions regardless of role.
    // ---------------------------------------------------------------------

    @Test
    void everyAuthenticatedRole_mayRead() throws Exception {
        for (String token : new String[] { driverToken, salesToken, adminToken }) {
            mockMvc.perform(get("/api/employees").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void driver_mayManageOwnSessions() throws Exception {
        mockMvc.perform(get("/api/auth/sessions").header("Authorization", "Bearer " + driverToken))
                .andExpect(status().isOk());

        // "log out my other devices" is a DELETE under /api/auth/** - it must not
        // fall into the office-staff-only DELETE rule.
        mockMvc.perform(delete("/api/auth/sessions").header("Authorization", "Bearer " + driverToken))
                .andExpect(status().isNoContent());
    }

    @Test
    void admin_mayDoEverything() throws Exception {
        mockMvc.perform(get("/api/admin/employees").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        int status = mockMvc.perform(post("/api/clients")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("not-json"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(400);
    }

    @Test
    void infrastructureConsoles_areNeverRoutable() throws Exception {
        int status = mockMvc.perform(get("/h2-console/")
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getStatus();

        assertThat(status).isIn(401, 403, 404);
    }
}
