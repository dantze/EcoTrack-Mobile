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
        Employee employee = new Employee(username, "Test Employee", "0700000000");
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

    // -----------------------------------------------------------------------
    // Session hygiene: cap, session-level expiry, pruning
    // -----------------------------------------------------------------------

    @Test
    void issueNewSession_beyondTheCap_revokesTheLeastRecentlyUsedSessions() {
        // Built by hand rather than injected so the cap is small enough to hit
        // without opening ten sessions.
        TokenService capped = new TokenService(sessionRepository, 30, 60, 2, 30);
        Employee employee = newEmployee("token_svc_cap");

        TokenService.IssuedTokens oldest = capped.issueNewSession(employee, "Device-A");
        TokenService.IssuedTokens middle = capped.issueNewSession(employee, "Device-B");
        TokenService.IssuedTokens newest = capped.issueNewSession(employee, "Device-C");

        // Three logins, cap of two: the least-recently-used one is revoked, and a
        // 60-day refresh token on a forgotten device stops being a live key.
        assertThat(capped.validateAccessToken(oldest.accessToken())).isEmpty();
        assertThat(capped.rotate(oldest.refreshToken(), "Device-A")).isEmpty();
        assertThat(capped.validateAccessToken(middle.accessToken())).isPresent();
        assertThat(capped.validateAccessToken(newest.accessToken())).isPresent();

        Session revoked = sessionRepository.findById(oldest.sessionId()).orElseThrow();
        assertThat(revoked.getRevokedReason()).isEqualTo("SESSION_LIMIT_EXCEEDED");
    }

    @Test
    void validateAccessToken_whenTheSessionItselfHasExpired_returnsEmpty() {
        Employee employee = newEmployee("token_svc_session_expiry");
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "Device-A");

        // Access token still inside its own 30-minute window, but the session it
        // belongs to has run out - it must not outlive its session.
        Session session = sessionRepository.findById(tokens.sessionId()).orElseThrow();
        session.setExpiresAt(Instant.now().minusSeconds(1));
        sessionRepository.save(session);

        assertThat(tokenService.validateAccessToken(tokens.accessToken())).isEmpty();
    }

    @Test
    void pruneStaleSessions_deletesOnlyRowsThatCanNoLongerAuthenticateAnyone() {
        // Retention of 0 days: anything already revoked or expired is prunable.
        TokenService pruning = new TokenService(sessionRepository, 30, 60, 10, 0);
        Employee employee = newEmployee("token_svc_prune");

        TokenService.IssuedTokens live = pruning.issueNewSession(employee, "Device-live");
        TokenService.IssuedTokens loggedOut = pruning.issueNewSession(employee, "Device-loggedout");
        TokenService.IssuedTokens expired = pruning.issueNewSession(employee, "Device-expired");

        pruning.revokeByRefreshToken(loggedOut.refreshToken());
        Session expiredSession = sessionRepository.findById(expired.sessionId()).orElseThrow();
        expiredSession.setExpiresAt(Instant.now().minusSeconds(60));
        sessionRepository.saveAndFlush(expiredSession);

        int deleted = pruning.pruneStaleSessions();

        assertThat(deleted).isEqualTo(2);
        assertThat(sessionRepository.findById(live.sessionId())).isPresent();
        assertThat(sessionRepository.findById(loggedOut.sessionId())).isEmpty();
        assertThat(sessionRepository.findById(expired.sessionId())).isEmpty();
    }

    @Test
    void revokeAllSessions_killsEveryDeviceIncludingTheCurrentOne() {
        Employee employee = newEmployee("token_svc_revoke_all");
        TokenService.IssuedTokens deviceA = tokenService.issueNewSession(employee, "Device-A");
        TokenService.IssuedTokens deviceB = tokenService.issueNewSession(employee, "Device-B");

        int revoked = tokenService.revokeAllSessions(employee.getId(), "PASSWORD_CHANGED");

        assertThat(revoked).isEqualTo(2);
        assertThat(tokenService.validateAccessToken(deviceA.accessToken())).isEmpty();
        assertThat(tokenService.validateAccessToken(deviceB.accessToken())).isEmpty();
        assertThat(tokenService.listActiveSessions(employee.getId())).isEmpty();
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

    @Test
    void rotate_reuseOfATokenSeveralRotationsOld_stillRevokesTheSession() {
        Employee employee = newEmployee("token_svc_deep_reuse");
        TokenService.IssuedTokens stolen = tokenService.issueNewSession(employee, "Device-A");

        // The legitimate client keeps refreshing normally while an attacker sits
        // on the token it started with. Tracking only the immediately-preceding
        // hash, this replay would simply find nothing and be silently ignored -
        // the theft would go unnoticed and the session would stay live.
        TokenService.IssuedTokens live = tokenService.rotate(stolen.refreshToken(), "Device-A").orElseThrow();
        live = tokenService.rotate(live.refreshToken(), "Device-A").orElseThrow();
        live = tokenService.rotate(live.refreshToken(), "Device-A").orElseThrow();

        assertThat(tokenService.rotate(stolen.refreshToken(), "Device-A")).isEmpty();

        Session session = sessionRepository.findById(stolen.sessionId()).orElseThrow();
        assertThat(session.getRevokedReason()).isEqualTo("REFRESH_TOKEN_REUSE_DETECTED");
        // The tokens the honest client is holding die with the family.
        assertThat(tokenService.validateAccessToken(live.accessToken())).isEmpty();
        assertThat(tokenService.rotate(live.refreshToken(), "Device-A")).isEmpty();
    }

    @Test
    void rotate_reuseDetection_doesNotTouchTheEmployeesOtherSessions() {
        Employee employee = newEmployee("token_svc_reuse_scope");
        TokenService.IssuedTokens phone = tokenService.issueNewSession(employee, "Device-phone");
        TokenService.IssuedTokens laptop = tokenService.issueNewSession(employee, "Device-laptop");

        tokenService.rotate(laptop.refreshToken(), "Device-laptop").orElseThrow();
        assertThat(tokenService.rotate(laptop.refreshToken(), "Device-laptop")).isEmpty();

        // A leaked family is not a compromised account - the phone stays signed
        // in. revokeAllSessions() is the tool for the account-level case.
        assertThat(tokenService.validateAccessToken(phone.accessToken())).isPresent();
    }

    @Test
    void rotate_retiredHashChain_staysBounded() {
        Employee employee = newEmployee("token_svc_chain_bound");
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(employee, "Device-A");

        // A session refreshing every 30 minutes for 60 days rotates ~2900 times;
        // the row must not grow with it.
        for (int i = 0; i < 25; i++) {
            tokens = tokenService.rotate(tokens.refreshToken(), "Device-A").orElseThrow();
        }

        Session session = sessionRepository.findById(tokens.sessionId()).orElseThrow();
        assertThat(session.getRetiredRefreshTokenHashes()).hasSize(10);
    }

    @Test
    void pruneStaleSessions_alsoRemovesTheRetiredTokenChain() {
        TokenService pruning = new TokenService(sessionRepository, 30, 60, 10, 0);
        Employee employee = newEmployee("token_svc_prune_chain");

        TokenService.IssuedTokens tokens = pruning.issueNewSession(employee, "Device-A");
        TokenService.IssuedTokens rotated = pruning.rotate(tokens.refreshToken(), "Device-A").orElseThrow();
        pruning.revokeByRefreshToken(rotated.refreshToken());

        // A bulk `DELETE FROM Session` would strand the session_retired_tokens
        // rows or trip their foreign key - see SessionRepository#findStaleSessions.
        assertThat(pruning.pruneStaleSessions()).isEqualTo(1);
        assertThat(sessionRepository.findById(tokens.sessionId())).isEmpty();
    }

    @Test
    void rotate_blankOrNullToken_isRejectedWithoutHashing() {
        assertThat(tokenService.rotate(null, "Device-A")).isEmpty();
        assertThat(tokenService.rotate("   ", "Device-A")).isEmpty();
    }
}
