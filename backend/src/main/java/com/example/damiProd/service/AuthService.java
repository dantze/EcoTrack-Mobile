package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.LoginRequest;
import com.example.damiProd.dto.LoginResponse;
import com.example.damiProd.dto.RefreshResponse;
import com.example.damiProd.dto.SessionResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final GoogleAuthService googleAuthService;
    private final LoginRateLimiter loginRateLimiter;

    public AuthService(EmployeeRepository employeeRepository,
            PasswordEncoder passwordEncoder,
            TokenService tokenService,
            GoogleAuthService googleAuthService,
            LoginRateLimiter loginRateLimiter) {
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.googleAuthService = googleAuthService;
        this.loginRateLimiter = loginRateLimiter;
    }

    /**
     * Username/password login. Verifies bcrypt hashes; if the stored value is
     * still legacy plaintext, falls back to a constant-time comparison and,
     * on success, transparently re-hashes and saves the password so the
     * legacy value drains over time without locking anyone out.
     */
    @Transactional
    public LoginResponse login(LoginRequest request, String clientIp, String userAgent) {
        String username = request.getUsername();

        if (loginRateLimiter.isBlocked(username, clientIp)) {
            return new LoginResponse(false, "Prea multe încercări eșuate. Încearcă din nou mai târziu.");
        }

        Optional<Employee> employeeOpt = employeeRepository.findByUsername(username);
        if (employeeOpt.isEmpty()) {
            loginRateLimiter.recordFailure(username, clientIp);
            return new LoginResponse(false, "Utilizator inexistent");
        }

        Employee employee = employeeOpt.get();
        if (!passwordMatches(request.getPassword(), employee)) {
            loginRateLimiter.recordFailure(username, clientIp);
            return new LoginResponse(false, "Parolă incorectă");
        }

        loginRateLimiter.recordSuccess(username, clientIp);
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, userAgent);
        return buildSuccessResponse(employee, tokens);
    }

    /**
     * Google sign-in. Admin-provisioned only: the verified email must match
     * an existing Employee, otherwise this returns a failed response (the
     * controller maps that to 403). See GoogleAuthService for the actual
     * token verification (signature/issuer/audience/expiry/domain).
     */
    @Transactional
    public LoginResponse loginWithGoogle(String idToken, String userAgent) {
        Optional<GoogleIdToken.Payload> payloadOpt = googleAuthService.verify(idToken);
        if (payloadOpt.isEmpty()) {
            return new LoginResponse(false, "Token Google invalid sau domeniu nepermis.");
        }

        GoogleIdToken.Payload payload = payloadOpt.get();
        String email = payload.getEmail();
        String sub = payload.getSubject();

        Optional<Employee> employeeOpt = employeeRepository.findByEmailIgnoreCase(email);
        if (employeeOpt.isEmpty()) {
            return new LoginResponse(false, "Acest cont Google nu este asociat niciunui angajat.");
        }

        Employee employee = employeeOpt.get();
        if (employee.getGoogleSub() == null) {
            // First successful Google login for this employee: bind the sub so a
            // later change to `email` cannot silently hijack the account.
            employee.setGoogleSub(sub);
            employeeRepository.save(employee);
        } else if (!employee.getGoogleSub().equals(sub)) {
            log.warn("Google login rejected: sub mismatch for employee id={}", employee.getId());
            return new LoginResponse(false, "Acest cont Google nu este asociat niciunui angajat.");
        }

        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, userAgent);
        return buildSuccessResponse(employee, tokens);
    }

    public Optional<RefreshResponse> refresh(String refreshToken, String userAgent) {
        return tokenService.rotate(refreshToken, userAgent)
                .map(tokens -> new RefreshResponse(tokens.accessToken(), tokens.refreshToken(), tokens.expiresInSeconds()));
    }

    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenService.revokeByRefreshToken(refreshToken);
        }
    }

    public List<SessionResponse> listSessions(Long employeeId, Long currentSessionId) {
        return tokenService.listActiveSessions(employeeId).stream()
                .map(session -> SessionResponse.fromEntity(session, session.getId().equals(currentSessionId)))
                .collect(Collectors.toList());
    }

    public boolean revokeSession(Long employeeId, Long sessionId) {
        return tokenService.revokeSession(employeeId, sessionId);
    }

    public void revokeOtherSessions(Long employeeId, Long currentSessionId) {
        tokenService.revokeAllOtherSessions(employeeId, currentSessionId);
    }

    private boolean passwordMatches(String rawPassword, Employee employee) {
        String stored = employee.getPassword();
        if (stored == null || rawPassword == null) {
            return false;
        }

        if (isBcryptHash(stored)) {
            return passwordEncoder.matches(rawPassword, stored);
        }

        // Legacy plaintext account: constant-time compare, then migrate on success.
        boolean matches = constantTimeEquals(rawPassword, stored);
        if (matches) {
            log.warn("Legacy plaintext password used for employee id={} - migrating to bcrypt now", employee.getId());
            employee.setPassword(passwordEncoder.encode(rawPassword));
            employeeRepository.save(employee);
        }
        return matches;
    }

    private boolean isBcryptHash(String value) {
        return value.startsWith("$2");
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private LoginResponse buildSuccessResponse(Employee employee, TokenService.IssuedTokens tokens) {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setMessage("Autentificare reușită");

        response.setAccessToken(tokens.accessToken());
        response.setRefreshToken(tokens.refreshToken());
        response.setExpiresIn(tokens.expiresInSeconds());
        response.setUser(EmployeeResponse.fromEntity(employee));

        // Legacy flat fields - kept for the existing mobile app, do not remove.
        response.setId(employee.getId());
        response.setUsername(employee.getUsername());
        response.setFullName(employee.getFullName());
        response.setPhone(employee.getPhone());
        response.setCounty(employee.getCounty());

        Set<String> roleNames = employee.getRoles().stream()
                .map(EmployeeRole::getRoleName)
                .collect(Collectors.toSet());
        response.setRoles(roleNames);

        return response;
    }
}
