package com.example.damiProd.SecurityTests;

import com.example.damiProd.repository.AccessRequestRepository;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.SessionRepository;
import com.example.damiProd.service.EnrollmentService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The operator-chosen first-run code (TODO-36).
 *
 * Without it the only way to learn the setup code is SSH plus
 * {@code docker compose logs}, so a non-technical person cannot perform the very
 * first enrolment. Setting it up front removes that step without weakening the
 * gate - as long as it is long enough, which
 * {@link ShortConfiguredSetupCodeTest} pins separately.
 */
@SpringBootTest
@AutoConfigureTestDatabase
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "ecotrack.enrollment.require-setup-code=true",
        "ecotrack.enrollment.setup-code=" + ConfiguredSetupCodeTest.CODE,
})
class ConfiguredSetupCodeTest {

    static final String CODE = "chosen-by-the-operator";

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
        // The code is latched at ApplicationReadyEvent, which has already fired
        // for this shared context - and an earlier test in the class consumed it.
        enrollmentService.announceSetupCodeIfUnclaimed();
    }

    private void request(String code, int expectedStatus) throws Exception {
        Map<String, Object> payload = code == null
                ? Map.of("fullName", "Andrei Dan", "deviceId", "device-1")
                : Map.of("fullName", "Andrei Dan", "deviceId", "device-1", "setupCode", code);
        mockMvc.perform(post("/api/enrollment/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    void theConfiguredCode_claimsTheInstance() throws Exception {
        request(CODE, 200);
        assertThat(employeeRepository.count()).isEqualTo(1);
    }

    @Test
    void itIsCaseInsensitive_likeTheGeneratedOne() throws Exception {
        // Someone reads it off a deploy checklist and types it into a phone,
        // which capitalises as it pleases.
        request(CODE.toUpperCase(java.util.Locale.ROOT), 200);
        assertThat(employeeRepository.count()).isEqualTo(1);
    }

    @Test
    void aWrongCode_isStillRefused() throws Exception {
        request("not-the-configured-code", 403);
        assertThat(employeeRepository.count()).isZero();
    }

    @Test
    void noCodeAtAll_isStillRefused() throws Exception {
        request(null, 403);
        assertThat(employeeRepository.count()).isZero();
    }

    @Test
    void itIsInertOnceAnEmployeeExists() throws Exception {
        request(CODE, 200);
        assertThat(employeeRepository.count()).isEqualTo(1);

        // Not first run any more, so this is neither a bootstrap nor a lockout
        // (the first admin has not claimed tokens, but they hold no session
        // either - so presenting the code again must not mint a second ADMIN).
        Map<String, Object> payload = Map.of(
                "fullName", "Altcineva", "deviceId", "device-2", "setupCode", CODE);
        mockMvc.perform(post("/api/enrollment/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden());
        assertThat(employeeRepository.count()).isEqualTo(1);
    }
}
