package com.example.damiProd.SecurityTests;

import com.example.damiProd.repository.AccessRequestRepository;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.SessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The guard on "first user becomes admin".
 *
 * Left bare, that rule is a land-grab: whoever reaches a freshly deployed
 * server first owns it permanently, and with no password there is no way to
 * take it back. The setup code closes that window.
 */
@SpringBootTest
@AutoConfigureTestDatabase
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "ecotrack.enrollment.require-setup-code=true")
class EnrollmentBootstrapCodeTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private SessionRepository sessionRepository;

    @BeforeEach
    void reset() {
        // Sessions carry an FK to employees, so they go first.
        sessionRepository.deleteAll();
        accessRequestRepository.deleteAll();
        employeeRepository.deleteAll();
    }

    @Test
    void bootstrapWithoutTheCode_isRefused() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "fullName", "Cineva", "deviceId", "device-1"));

        mockMvc.perform(post("/api/enrollment/request")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        assertThat(employeeRepository.count()).isZero();
    }

    @Test
    void bootstrapWithAWrongCode_isRefused() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "fullName", "Cineva", "deviceId", "device-1", "setupCode", "AAAA-BBBB"));

        mockMvc.perform(post("/api/enrollment/request")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        assertThat(employeeRepository.count()).isZero();
    }

    @Test
    void statusEndpoint_tellsTheClientToAskForTheCode() throws Exception {
        mockMvc.perform(get("/api/enrollment/status"))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .contains("\"setupCodeRequired\":true"));
    }
}
