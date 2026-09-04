package com.example.damiProd.SecurityTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.service.TokenService;
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

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The last-admin lockout guard (TODO-22).
 *
 * Why this is a security test and not a validation test: zero admins is
 * UNRECOVERABLE. Passwords and Google sign-in are gone, so there is no
 * break-glass credential, and the only path that mints an ADMIN without an
 * existing one is the first-user bootstrap in EnrollmentService - which fires
 * only when the employee table is EMPTY. Demote the last admin and the sole way
 * back into /api/admin/** is deleting every employee in the database.
 *
 * The guard existed only in web/src/features/admin/EmployeesPage.tsx, which
 * disables the buttons. That stops the screen and nothing else: a direct API
 * call, a script, or a future mobile admin view went straight through. These
 * tests run the real filter chain and the real service, so they assert the half
 * that actually holds.
 */
@SpringBootTest
@AutoConfigureTestDatabase
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LastAdminGuardTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmployeeRoleRepository employeeRoleRepository;

    private Employee soleAdmin;
    private String adminToken;

    @BeforeEach
    void setUp() {
        // "The last admin" is a statement about the WHOLE table, so this test
        // has to own that table.
        //
        // It used to have to TAKE it: the suite ran on one JVM-wide H2 database
        // and the classes that exercise the first-user bootstrap cannot be
        // @Transactional, so each committed an ADMIN that outlived it. This
        // method demoted every one of them before it could say anything.
        // TODO-31 gave every @SpringBootTest its own database instead
        // (@AutoConfigureTestDatabase; SuiteTests/DatabaseIsolationTest holds
        // the rule), so the table starts empty and the demotion is gone.
        soleAdmin = seed("guard_admin", "ADMIN");
        adminToken = tokenService.issueNewSession(soleAdmin, "test-device").accessToken();

        // Assert the precondition rather than trust it: if this ever stops
        // holding, the failure should name the setup, not look like a guard bug.
        // Cheap, and it is the thing that would break first if the isolation
        // were ever undone - which is exactly when a guard test failing for the
        // wrong reason costs the most.
        assertThat(employeeRepository.countByRoleName("ADMIN")).isEqualTo(1);
    }

    // ---------------------------------------------------------------- refusals

    @Test
    void demotingTheLastAdmin_isRefusedWithConflict() throws Exception {
        mockMvc.perform(put("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleNames\":[\"SALES\"]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void deletingTheLastAdmin_isRefusedWithConflict() throws Exception {
        mockMvc.perform(delete("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    /**
     * The refusal must leave nothing behind. updateEmployee applies the scalar
     * fields BEFORE it reaches the roles block, so a guard that threw after the
     * swap - or a controller that swallowed the exception - would answer 409 and
     * still have written something.
     */
    @Test
    void aRefusedDemotion_leavesTheAdminRoleIntact() throws Exception {
        mockMvc.perform(put("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleNames\":[\"SALES\"]}"))
                .andExpect(status().isConflict());

        Employee after = employeeRepository.findById(soleAdmin.getId()).orElseThrow();
        assertThat(roleNamesOf(after)).contains("ADMIN");
        assertThat(employeeRepository.countByRoleName("ADMIN")).isEqualTo(1);
    }

    /** The message is user-facing, so it is Romanian like the rest of the API. */
    @Test
    void theRefusalIsExplainedInRomanian() throws Exception {
        String body = mockMvc.perform(delete("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("ultimul administrator");
    }

    // ---------------------------------------------------------------- allowances

    /**
     * The guard is about the LAST admin, not about admins. With a second one in
     * place the demotion is ordinary business and must go through, or covering
     * for someone becomes impossible.
     */
    @Test
    void demotingOneOfTwoAdmins_isAllowed() throws Exception {
        Employee second = seed("guard_admin_2", "ADMIN");
        assertThat(employeeRepository.countByRoleName("ADMIN")).isEqualTo(2);

        mockMvc.perform(put("/api/admin/employees/" + second.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleNames\":[\"SALES\"]}"))
                .andExpect(status().isOk());

        assertThat(employeeRepository.countByRoleName("ADMIN")).isEqualTo(1);
    }

    @Test
    void deletingOneOfTwoAdmins_isAllowed() throws Exception {
        Employee second = seed("guard_admin_2", "ADMIN");

        mockMvc.perform(delete("/api/admin/employees/" + second.getId())
                        .header("Authorization", "Bearer " + adminToken))
                // 204 since TODO-76: a successful delete has no body.
                .andExpect(status().isNoContent());

        assertThat(employeeRepository.countByRoleName("ADMIN")).isEqualTo(1);
    }

    /**
     * A non-admin is deletable even when exactly one admin exists - the guard
     * keys on the target's roles, not on the size of the employee table.
     */
    @Test
    void deletingANonAdmin_isUnaffectedByTheGuard() throws Exception {
        Employee driver = seed("guard_driver", "DRIVER");

        mockMvc.perform(delete("/api/admin/employees/" + driver.getId())
                        .header("Authorization", "Bearer " + adminToken))
                // 204 since TODO-76: a successful delete has no body.
                .andExpect(status().isNoContent());
    }

    /**
     * Editing the last admin's NAME is not a demotion. The guard only fires on a
     * roles payload that drops ADMIN, so an ordinary edit must not be caught by
     * it - otherwise the sole admin could never correct their own phone number.
     */
    @Test
    void editingTheLastAdminWithoutTouchingRoles_isAllowed() throws Exception {
        mockMvc.perform(put("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Nume Nou\"}"))
                .andExpect(status().isOk());

        assertThat(employeeRepository.findById(soleAdmin.getId()).orElseThrow().getFullName())
                .isEqualTo("Nume Nou");
    }

    /**
     * Keeping ADMIN while ADDING another role is not a demotion either.
     */
    @Test
    void wideningTheLastAdminsRoles_isAllowed() throws Exception {
        mockMvc.perform(put("/api/admin/employees/" + soleAdmin.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleNames\":[\"ADMIN\",\"DRIVER\"]}"))
                .andExpect(status().isOk());

        assertThat(roleNamesOf(employeeRepository.findById(soleAdmin.getId()).orElseThrow()))
                .contains("ADMIN", "DRIVER");
    }

    // ---------------------------------------------------------------- helpers

    /**
     * The role set must be MUTABLE. An update that does not send roleNames leaves
     * the collection in place, and Hibernate's merge then calls clear() on it to
     * replace its elements - which throws UnsupportedOperationException on a
     * Set.of(...). Seeding with an immutable set turns an ordinary name edit into
     * a 500 that looks like a guard bug and is not one.
     */
    private Employee seed(String username, String roleName) {
        EmployeeRole role = employeeRoleRepository.findByRoleName(roleName)
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole(roleName)));
        return employeeRepository.findByUsername(username).orElseGet(() -> {
            Employee employee = new Employee(username, username, "0700000000");
            employee.setRoles(new HashSet<>(Set.of(role)));
            return employeeRepository.save(employee);
        });
    }

    private static Set<String> roleNamesOf(Employee employee) {
        return employee.getRoles().stream()
                .map(EmployeeRole::getRoleName)
                .collect(Collectors.toSet());
    }
}
