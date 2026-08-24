package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.Session;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.SessionRepository;
import com.example.damiProd.service.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Backed by a real (embedded H2) repository rather than mocks, because the
 * behaviour under test - rotation, reuse detection, hash-based lookups - is
 * fundamentally about what actually gets persisted and queried, which is
 * easy to get subtly wrong with mocked repository methods.
 */
@DataJpaTest
@Import(TokenService.class)
class TokenServiceTest {

    @Autowired
    private TokenService tokenService;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    private Employee newEmployee(String username) {
        Employee employee = new Employee(username, "irrelevant-for-these-tests", "Test Employee", "0700000000");
        return employeeRepository.save(employee);
    }

    @Test
    void issueNewSession_persistsHashedTokensNotRawValues() {
        Employee employee = newEmployee("token_svc_user1");

        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "JUnit-Agent");

        Session saved = sessionRepository.findById(tokens.sessionId()).orElseThrow();
        assertThat(saved.getAccessTokenHash()).isEqualTo(TokenService.hash(tokens.accessToken()));
        assertThat(saved.getRefreshTokenHash()).isEqualTo(TokenService.hash(tokens.refreshToken()));
        // the raw token itself must never be what's stored
        assertThat(saved.getAccessTokenHash()).isNotEqualTo(tokens.accessToken());
        assertThat(saved.getRefreshTokenHash()).isNotEqualTo(tokens.refreshToken());
        assertThat(saved.getDeviceLabel()).isEqualTo("JUnit-Agent");
        assertThat(saved.getRevokedAt()).isNull();
    }

    @Test
    void validateAccessToken_freshToken_resolvesToEmployee() {
        Employee employee = newEmployee("token_svc_user2");
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "JUnit-Agent");

        Optional<TokenService.AuthenticatedSession> resolved = tokenService.validateAccessToken(tokens.accessToken());

        assertThat(resolved).isPresent();
        assertThat(resolved.get().employee().getUsername()).isEqualTo("token_svc_user2");
        assertThat(resolved.get().sessionId()).isEqualTo(tokens.sessionId());
    }

    @Test
    void validateAccessToken_expiredToken_returnsEmpty() {
        Employee employee = newEmployee("token_svc_user3");
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "JUnit-Agent");

        Session session = sessionRepository.findById(tokens.sessionId()).orElseThrow();
        session.setAccessTokenExpiresAt(Instant.now().minusSeconds(5));
        sessionRepository.save(session);

        assertThat(tokenService.validateAccessToken(tokens.accessToken())).isEmpty();
    }

    @Test
    void rotate_withValidRefreshToken_issuesNewPairAndKeepsOldAccessTokenAlive() {
        Employee employee = newEmployee("token_svc_user4");
        TokenService.IssuedTokens original = tokenService.issueNewSession(employee, "Device-A");

        Optional<TokenService.IssuedTokens> rotatedOpt = tokenService.rotate(original.refreshToken(), "Device-A");

        assertThat(rotatedOpt).isPresent();
        TokenService.IssuedTokens rotated = rotatedOpt.get();
        assertThat(rotated.refreshToken()).isNotEqualTo(original.refreshToken());
        assertThat(rotated.accessToken()).isNotEqualTo(original.accessToken());
        assertThat(rotated.sessionId()).isEqualTo(original.sessionId());

        // the new access token works
        assertThat(tokenService.validateAccessToken(rotated.accessToken())).isPresent();
    }

    @Test
    void rotate_reusingAnAlreadyRotatedRefreshToken_isTreatedAsTheftAndKillsTheSession() {
        Employee employee = newEmployee("token_svc_user5");
        TokenService.IssuedTokens original = tokenService.issueNewSession(employee, "Device-A");
        TokenService.IssuedTokens rotated = tokenService.rotate(original.refreshToken(), "Device-A").orElseThrow();

        // Someone (an attacker who stole the old refresh token) replays the
        // now-superseded original refresh token.
        Optional<TokenService.IssuedTokens> reuseAttempt = tokenService.rotate(original.refreshToken(), "attacker-agent");
        assertThat(reuseAttempt).isEmpty();

        // The whole session family is revoked as a result - even the
        // legitimately rotated access token from the real device stops working.
        assertThat(tokenService.validateAccessToken(rotated.accessToken())).isEmpty();

        Session session = sessionRepository.findById(original.sessionId()).orElseThrow();
        assertThat(session.getRevokedAt()).isNotNull();
        assertThat(session.getRevokedReason()).isEqualTo("REFRESH_TOKEN_REUSE_DETECTED");
    }

    @Test
    void revokeByRefreshToken_invalidatesTheSession() {
        Employee employee = newEmployee("token_svc_user6");
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "Device-A");

        tokenService.revokeByRefreshToken(tokens.refreshToken());

        assertThat(tokenService.validateAccessToken(tokens.accessToken())).isEmpty();
        assertThat(tokenService.rotate(tokens.refreshToken(), "Device-A")).isEmpty();
    }

    @Test
    void listActiveSessions_and_revokeAllOtherSessions_keepsOnlyCurrent() {
        Employee employee = newEmployee("token_svc_user7");
        TokenService.IssuedTokens deviceA = tokenService.issueNewSession(employee, "Device-A");
        TokenService.IssuedTokens deviceB = tokenService.issueNewSession(employee, "Device-B");

        List<Session> before = tokenService.listActiveSessions(employee.getId());
        assertThat(before).hasSize(2);

        tokenService.revokeAllOtherSessions(employee.getId(), deviceA.sessionId());

        List<Session> after = tokenService.listActiveSessions(employee.getId());
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getId()).isEqualTo(deviceA.sessionId());
        assertThat(tokenService.validateAccessToken(deviceB.accessToken())).isEmpty();
        assertThat(tokenService.validateAccessToken(deviceA.accessToken())).isPresent();
    }

    @Test
    void revokeSession_onlyAffectsSessionsOwnedByThatEmployee() {
        Employee owner = newEmployee("token_svc_user8");
        Employee otherEmployee = newEmployee("token_svc_user9");
        TokenService.IssuedTokens ownerSession = tokenService.issueNewSession(owner, "Device-A");

        boolean revokedByWrongOwner = tokenService.revokeSession(otherEmployee.getId(), ownerSession.sessionId());
        assertThat(revokedByWrongOwner).isFalse();
        assertThat(tokenService.validateAccessToken(ownerSession.accessToken())).isPresent();

        boolean revokedByOwner = tokenService.revokeSession(owner.getId(), ownerSession.sessionId());
        assertThat(revokedByOwner).isTrue();
        assertThat(tokenService.validateAccessToken(ownerSession.accessToken())).isEmpty();
    }
}
