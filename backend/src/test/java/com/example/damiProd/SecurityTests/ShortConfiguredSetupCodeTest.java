package com.example.damiProd.SecurityTests;

import com.example.damiProd.repository.AccessRequestRepository;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.SessionRepository;
import com.example.damiProd.service.EnrollmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A too-short operator-chosen setup code is IGNORED, not obeyed (TODO-36).
 *
 * {@code /api/enrollment/request} is public and its rate limit is keyed on a
 * device id the client supplies, so a guessable first-run code hands the
 * instance to whoever guesses it - permanently, since there is no password path
 * back in. Falling back to a generated code fails in the direction that costs
 * one SSH session instead of the whole system.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "ecotrack.enrollment.require-setup-code=true",
        "ecotrack.enrollment.setup-code=short",
})
class ShortConfiguredSetupCodeTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private SessionRepository sessionRepository;
    @Autowired private EnrollmentService enrollmentService;

    @BeforeEach
    void reset() {
        // Sessions carry an FK to employees, so they go first.
        sessionRepository.deleteAll();
        accessRequestRepository.deleteAll();
        employeeRepository.deleteAll();
        enrollmentService.announceSetupCodeIfUnclaimed();
    }

    @Test
    void theShortCodeIsRefused_andTheInstanceStaysUnclaimed() throws Exception {
        mockMvc.perform(post("/api/enrollment/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Andrei Dan", "deviceId", "device-1",
                                "setupCode", "short"))))
                .andExpect(status().isForbidden());

        assertThat(employeeRepository.count()).isZero();
        // Still guarded, by a generated code this test cannot know.
        assertThat(enrollmentService.setupCodeRequired()).isTrue();
    }
}
