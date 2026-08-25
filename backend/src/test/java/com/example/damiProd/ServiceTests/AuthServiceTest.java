package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.LoginRequest;
import com.example.damiProd.dto.LoginResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.service.AuthService;
import com.example.damiProd.service.GoogleAuthService;
import com.example.damiProd.service.LoginRateLimiter;
import com.example.damiProd.service.TokenService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    /** The single message both "unknown user" and "wrong password" must produce. */
    private static final String GENERIC_FAILURE_MESSAGE = "Nume de utilizator sau parolă incorectă";

    @Mock private EmployeeRepository employeeRepository;
    @Mock private TokenService tokenService;
    @Mock private GoogleAuthService googleAuthService;
    @Mock private LoginRateLimiter loginRateLimiter;

    // Real bcrypt encoder (not mocked) so the legacy-vs-bcrypt branching is
    // exercised for real, not just asserted on a stub's behaviour.
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(employeeRepository, passwordEncoder, tokenService, googleAuthService, loginRateLimiter);
    }

    private void stubIssueNewSession() {
        when(tokenService.issueNewSession(any(Employee.class), anyString()))
                .thenReturn(new TokenService.IssuedTokens(1L, "access-token", "refresh-token", 1800L));
    }

    private Employee buildEmployee(String username, String storedPassword) {
        Employee employee = new Employee(username, storedPassword, "Test Employee", "0700000000");
        employee.setId(42L);
        EmployeeRole role = new EmployeeRole("DRIVER");
        role.setId(1L);
        employee.setRoles(Set.of(role));
        return employee;
    }

    // -----------------------------------------------------------------------
    // Password migration: legacy plaintext -> bcrypt
    // -----------------------------------------------------------------------

    @Test
    void login_withLegacyPlaintextPassword_succeedsAndMigratesToBcrypt() {
        stubIssueNewSession();
        Employee employee = buildEmployee("legacy_user", "plainpass123");
        when(employeeRepository.findByUsername("legacy_user")).thenReturn(Optional.of(employee));

        LoginResponse response = authService.login(new LoginRequest("legacy_user", "plainpass123"), "1.2.3.4", "JUnit");

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getAccessToken()).isEqualTo("access-token");

        ArgumentCaptor<Employee> captor = ArgumentCaptor.forClass(Employee.class);
        verify(employeeRepository).save(captor.capture());
        String migratedPassword = captor.getValue().getPassword();
        assertThat(migratedPassword).startsWith("$2");
        assertThat(passwordEncoder.matches("plainpass123", migratedPassword)).isTrue();
    }

    @Test
    void login_withLegacyPlaintextPassword_wrongPassword_failsWithoutMigrating() {
        Employee employee = buildEmployee("legacy_user2", "plainpass123");
        when(employeeRepository.findByUsername("legacy_user2")).thenReturn(Optional.of(employee));

        LoginResponse response = authService.login(new LoginRequest("legacy_user2", "wrong"), "1.2.3.4", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getMessage()).isEqualTo(GENERIC_FAILURE_MESSAGE);
        verify(employeeRepository, never()).save(any());
        verify(loginRateLimiter).recordFailure("legacy_user2", "1.2.3.4");
    }

    @Test
    void login_withBcryptPassword_verifiesDirectlyWithoutRehashing() {
        stubIssueNewSession();
        String hashed = passwordEncoder.encode("secret123");
        Employee employee = buildEmployee("bcrypt_user", hashed);
        when(employeeRepository.findByUsername("bcrypt_user")).thenReturn(Optional.of(employee));

        LoginResponse response = authService.login(new LoginRequest("bcrypt_user", "secret123"), "1.2.3.4", "JUnit");

        assertThat(response.isSuccess()).isTrue();
        verify(employeeRepository, never()).save(any());
    }

    // -----------------------------------------------------------------------
    // Account enumeration: "no such user" and "wrong password" must be
    // indistinguishable, in the message and in the work done.
    // -----------------------------------------------------------------------

    @Test
    void login_unknownUsername_returnsTheSameMessageAsAWrongPassword() {
        when(employeeRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        Employee realEmployee = buildEmployee("real_user", passwordEncoder.encode("secret123"));
        when(employeeRepository.findByUsername("real_user")).thenReturn(Optional.of(realEmployee));

        LoginResponse unknownUser = authService.login(new LoginRequest("ghost", "whatever"), "1.2.3.4", "JUnit");
        LoginResponse wrongPassword = authService.login(new LoginRequest("real_user", "nope"), "1.2.3.4", "JUnit");

        assertThat(unknownUser.isSuccess()).isFalse();
        assertThat(wrongPassword.isSuccess()).isFalse();
        // One message for both, or the endpoint is a free "does this account
        // exist?" oracle.
        assertThat(unknownUser.getMessage()).isEqualTo(GENERIC_FAILURE_MESSAGE);
        assertThat(wrongPassword.getMessage()).isEqualTo(unknownUser.getMessage());
        // Both paths are counted, so enumeration cannot outrun the throttle either.
        verify(loginRateLimiter).recordFailure("ghost", "1.2.3.4");
        verify(loginRateLimiter).recordFailure("real_user", "1.2.3.4");
    }

    @Test
    void login_unknownUsername_stillSpendsBcryptTimeSoTimingDoesNotLeakExistence() {
        when(employeeRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        long start = System.nanoTime();
        authService.login(new LoginRequest("ghost", "whatever"), "1.2.3.4", "JUnit");
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        // A bare repository miss returns in well under a millisecond; a real bcrypt
        // verification cannot. The exact figure is machine-dependent, so this only
        // asserts "hashing actually happened".
        assertThat(elapsedMs).isGreaterThan(3);
    }

    // -----------------------------------------------------------------------
    // Input the login endpoint must reject before doing any work
    // -----------------------------------------------------------------------

    @Test
    void login_withBlankCredentials_isRejectedWithoutTouchingTheDatabaseOrThrottle() {
        LoginResponse blankUsername = authService.login(new LoginRequest("   ", "pass"), "1.2.3.4", "JUnit");
        LoginResponse blankPassword = authService.login(new LoginRequest("someone", ""), "1.2.3.4", "JUnit");
        LoginResponse nullBoth = authService.login(new LoginRequest(null, null), "1.2.3.4", "JUnit");

        assertThat(blankUsername.isSuccess()).isFalse();
        assertThat(blankPassword.isSuccess()).isFalse();
        assertThat(nullBoth.isSuccess()).isFalse();
        assertThat(nullBoth.getMessage()).isEqualTo(GENERIC_FAILURE_MESSAGE);
        verifyNoInteractions(employeeRepository);
        verifyNoInteractions(loginRateLimiter);
    }

    @Test
    void login_withAbsurdlyLongPassword_isRejectedBeforeHashing() {
        // bcrypt ignores everything past 72 bytes anyway; accepting megabyte
        // "passwords" just means hashing whatever an anonymous caller sends.
        String huge = "x".repeat(100_000);

        LoginResponse response = authService.login(new LoginRequest("someone", huge), "1.2.3.4", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        verifyNoInteractions(employeeRepository);
    }

    @Test
    void loginWithGoogle_withOversizedIdToken_isRejectedBeforeVerification() {
        LoginResponse response = authService.loginWithGoogle("y".repeat(50_000), "JUnit");

        assertThat(response.isSuccess()).isFalse();
        verifyNoInteractions(googleAuthService);
        verifyNoInteractions(employeeRepository);
    }

    @Test
    void login_whenRateLimited_shortCircuitsBeforeHittingRepository() {
        when(loginRateLimiter.isBlocked("throttled_user", "9.9.9.9")).thenReturn(true);

        LoginResponse response = authService.login(new LoginRequest("throttled_user", "x"), "9.9.9.9", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        verifyNoInteractions(employeeRepository);
    }

    // -----------------------------------------------------------------------
    // Google sign-in: matched / not matched / hijack prevention
    // -----------------------------------------------------------------------

    private GoogleIdToken.Payload googlePayload(String email, String sub) {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setEmail(email);
        payload.setSubject(sub);
        payload.setEmailVerified(true);
        return payload;
    }

    @Test
    void loginWithGoogle_emailMatchesProvisionedEmployee_bindsSubAndIssuesSession() {
        stubIssueNewSession();
        Employee employee = buildEmployee("google_user", "$2a$10$irrelevant");
        employee.setEmail("alice@ecotrack.ro");
        when(googleAuthService.verify("valid-id-token")).thenReturn(Optional.of(googlePayload("alice@ecotrack.ro", "google-sub-1")));
        when(employeeRepository.findByEmailIgnoreCase("alice@ecotrack.ro")).thenReturn(Optional.of(employee));

        LoginResponse response = authService.loginWithGoogle("valid-id-token", "JUnit");

        assertThat(response.isSuccess()).isTrue();
        ArgumentCaptor<Employee> captor = ArgumentCaptor.forClass(Employee.class);
        verify(employeeRepository).save(captor.capture());
        assertThat(captor.getValue().getGoogleSub()).isEqualTo("google-sub-1");
    }

    @Test
    void loginWithGoogle_emailNotProvisioned_returnsFailureWithoutSelfSignup() {
        when(googleAuthService.verify("valid-id-token")).thenReturn(Optional.of(googlePayload("nobody@ecotrack.ro", "google-sub-2")));
        when(employeeRepository.findByEmailIgnoreCase("nobody@ecotrack.ro")).thenReturn(Optional.empty());

        LoginResponse response = authService.loginWithGoogle("valid-id-token", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getMessage()).contains("nu este asociat");
        verify(employeeRepository, never()).save(any());
        verify(tokenService, never()).issueNewSession(any(), anyString());
    }

    @Test
    void loginWithGoogle_tokenRejectedByVerifier_returnsFailure() {
        // Covers both "signature/issuer/audience invalid" and "wrong domain"
        // cases, which GoogleAuthService.verify() collapses to empty() -
        // see GoogleAuthServiceTest for the domain-matching rule itself.
        when(googleAuthService.verify("bad-token")).thenReturn(Optional.empty());

        LoginResponse response = authService.loginWithGoogle("bad-token", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        verifyNoInteractions(employeeRepository);
    }

    @Test
    void loginWithGoogle_subMismatchOnAlreadyBoundAccount_isRejectedAsPossibleHijack() {
        Employee employee = buildEmployee("google_user2", "$2a$10$irrelevant");
        employee.setEmail("bob@ecotrack.ro");
        employee.setGoogleSub("original-sub");
        when(googleAuthService.verify("valid-id-token")).thenReturn(Optional.of(googlePayload("bob@ecotrack.ro", "different-sub")));
        when(employeeRepository.findByEmailIgnoreCase("bob@ecotrack.ro")).thenReturn(Optional.of(employee));

        LoginResponse response = authService.loginWithGoogle("valid-id-token", "JUnit");

        assertThat(response.isSuccess()).isFalse();
        verify(employeeRepository, never()).save(any());
        verify(tokenService, never()).issueNewSession(any(), anyString());
    }
}
