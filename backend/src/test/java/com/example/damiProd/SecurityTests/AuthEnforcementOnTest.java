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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the real (not addFilters=false) security filter chain with
 * ecotrack.security.enforce=true, which is the default under the "test"
 * profile - see application-test.properties. Compare with
 * {@link AuthEnforcementOffTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
// Keeps setUp()'s writes (and the MockMvc-driven login itself, which runs on the
// same thread under MOCK webEnvironment) inside one transaction per test method,
// auto-rolled-back afterwards. Without this, each repository call in setUp() opens
// its own transaction and the EmployeeRole fetched in one call becomes detached
// by the time it's cascaded into employeeRepository.save() in the next.
@Transactional
class AuthEnforcementOnTest {

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

    @BeforeEach
    void setUp() {
        EmployeeRole driverRole = employeeRoleRepository.findByRoleName("DRIVER")
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole("DRIVER")));
        EmployeeRole adminRole = employeeRoleRepository.findByRoleName("ADMIN")
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole("ADMIN")));

        if (employeeRepository.findByUsername("enforce_on_driver").isEmpty()) {
            Employee driver = new Employee("enforce_on_driver", passwordEncoder.encode("driverpass"), "Driver", "0700000001");
            driver.setRoles(Set.of(driverRole));
            employeeRepository.save(driver);
        }
        if (employeeRepository.findByUsername("enforce_on_admin").isEmpty()) {
            Employee admin = new Employee("enforce_on_admin", passwordEncoder.encode("adminpass"), "Admin", "0700000002");
            admin.setRoles(Set.of(adminRole));
            employeeRepository.save(admin);
        }
    }

    private String loginAndGetAccessToken(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginBody(username, password));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(responseJson);
        return node.get("accessToken").asText();
    }

    record LoginBody(String username, String password) {
    }

    @Test
    void anonymousRequestToBusinessEndpoint_isRejected() throws Exception {
        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validAccessToken_grantsAccessToBusinessEndpoint() throws Exception {
        String token = loginAndGetAccessToken("enforce_on_driver", "driverpass");

        mockMvc.perform(get("/api/employees").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void nonAdminToken_isForbiddenFromAdminEndpoint() throws Exception {
        String token = loginAndGetAccessToken("enforce_on_driver", "driverpass");

        mockMvc.perform(get("/api/admin/employees").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminToken_canReachAdminEndpoint() throws Exception {
        String token = loginAndGetAccessToken("enforce_on_admin", "adminpass");

        mockMvc.perform(get("/api/admin/employees").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void garbageToken_isRejected() throws Exception {
        mockMvc.perform(get("/api/employees").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginItselfRemainsPubliclyReachable() throws Exception {
        // /api/auth/login must stay reachable without a token - otherwise nobody could ever log in.
        String token = loginAndGetAccessToken("enforce_on_driver", "driverpass");
        assertThat(token).isNotBlank();
    }
}
