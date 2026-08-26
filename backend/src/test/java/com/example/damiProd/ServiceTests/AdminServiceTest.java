package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.service.AdminService;
import com.example.damiProd.service.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Focused on the one thing admin edits get wrong by default: an admin changing
 * a password (the response to "this account is compromised" / "they left") does
 * not by itself stop the old credentials working. Every device that ever logged
 * in holds a refresh token good for another 60 days.
 */
@DataJpaTest
@Import({ AdminService.class, TokenService.class, AdminServiceTest.EncoderConfig.class })
class AdminServiceTest {

    @TestConfiguration
    static class EncoderConfig {
        /** Cost 4, not the app's 12: these tests hash a lot and verify nothing about the cost. */
        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder(4);
        }
    }

    @Autowired
    private AdminService adminService;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Employee newEmployee(String username) {
        return employeeRepository.save(new Employee(username, "unused", "Test Employee", "0700000000"));
    }

    private CreateEmployeeRequest request() {
        return new CreateEmployeeRequest();
    }

    @Test
    void updateEmployee_passwordChange_revokesEveryExistingSession() {
        Employee employee = newEmployee("admin_svc_pw");
        TokenService.IssuedTokens phone = tokenService.issueNewSession(employee, "Device-phone");
        TokenService.IssuedTokens laptop = tokenService.issueNewSession(employee, "Device-laptop");

        CreateEmployeeRequest change = request();
        change.setPassword("a-brand-new-password");
        adminService.updateEmployee(employee.getId(), change).orElseThrow();

        assertThat(tokenService.validateAccessToken(phone.accessToken())).isEmpty();
        assertThat(tokenService.validateAccessToken(laptop.accessToken())).isEmpty();
        // The 60-day refresh tokens have to die too, or the lockout lasts 30 minutes.
        assertThat(tokenService.rotate(phone.refreshToken(), "Device-phone")).isEmpty();
        assertThat(tokenService.rotate(laptop.refreshToken(), "Device-laptop")).isEmpty();
    }

    @Test
    void updateEmployee_roleChange_revokesEverySessionToo() {
        Employee employee = newEmployee("admin_svc_roles");
        TokenService.IssuedTokens session = tokenService.issueNewSession(employee, "Device-A");

        CreateEmployeeRequest change = request();
        change.setRoleNames(Set.of("DRIVER"));
        adminService.updateEmployee(employee.getId(), change).orElseThrow();

        // A demotion that leaves the demoted session alive is not a demotion.
        assertThat(tokenService.validateAccessToken(session.accessToken())).isEmpty();
    }

    @Test
    void updateEmployee_ordinaryProfileEdit_leavesSessionsAlone() {
        Employee employee = newEmployee("admin_svc_profile");
        TokenService.IssuedTokens session = tokenService.issueNewSession(employee, "Device-A");

        CreateEmployeeRequest change = request();
        change.setPhone("0799999999");
        change.setCounty("Cluj");
        adminService.updateEmployee(employee.getId(), change).orElseThrow();

        // Correcting a phone number must not sign someone out mid-route.
        assertThat(tokenService.validateAccessToken(session.accessToken())).isPresent();
    }

    @Test
    void updateEmployee_resendingTheSameRoles_isNotTreatedAsAChange() {
        Employee employee = newEmployee("admin_svc_same_roles");
        CreateEmployeeRequest initial = request();
        initial.setRoleNames(Set.of("DRIVER"));
        adminService.updateEmployee(employee.getId(), initial).orElseThrow();

        TokenService.IssuedTokens session = tokenService.issueNewSession(employee, "Device-A");

        // The web app sends the full role list on every save, so a no-op edit
        // would otherwise log the employee out every time an admin touched them.
        CreateEmployeeRequest unchanged = request();
        unchanged.setRoleNames(Set.of("DRIVER"));
        unchanged.setFullName("Test Employee Renamed");
        adminService.updateEmployee(employee.getId(), unchanged).orElseThrow();

        assertThat(tokenService.validateAccessToken(session.accessToken())).isPresent();
    }

    @Test
    void createEmployee_storesABcryptHashNotTheRawPassword() {
        CreateEmployeeRequest create = request();
        create.setUsername("admin_svc_created");
        create.setPassword("plaintext-secret");
        create.setFullName("Created Employee");
        create.setRoleNames(Set.of("SALES"));

        EmployeeResponse created = adminService.createEmployee(create);

        Employee stored = employeeRepository.findById(created.getId()).orElseThrow();
        assertThat(stored.getPassword()).isNotEqualTo("plaintext-secret");
        assertThat(stored.getPassword()).startsWith("$2");
        assertThat(passwordEncoder.matches("plaintext-secret", stored.getPassword())).isTrue();
    }
}
