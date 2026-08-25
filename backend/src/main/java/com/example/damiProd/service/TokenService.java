package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.Session;
import com.example.damiProd.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Issues, rotates and validates the opaque access/refresh tokens backing
 * {@link com.example.damiProd.domain.Session}.
 *
 * Tokens are random bytes from {@link SecureRandom}, never JWTs. Only their
 * SHA-256 hash is ever persisted or compared, and hash lookups go through
 * the database's unique index rather than an in-memory equals() - there is
 * no code path that compares a raw secret byte-by-byte except the legacy
 * plaintext-password fallback in {@link AuthService}, which uses
 * {@link MessageDigest#isEqual(byte[], byte[])} for that reason.
 */
@Service
public class TokenService {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private static final int TOKEN_BYTES = 32; // 256 bits of entropy per token
    private static final int MAX_DEVICE_LABEL_LENGTH = 200;

    private final SessionRepository sessionRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    private final Duration accessTokenTtl;
    private final Duration refreshTokenTtl;
    private final int maxSessionsPerUser;
    private final Duration sessionRetention;

    public TokenService(SessionRepository sessionRepository,
            @Value("${ecotrack.security.access-token-ttl-minutes:30}") long accessTokenTtlMinutes,
            @Value("${ecotrack.security.refresh-token-ttl-days:60}") long refreshTokenTtlDays,
            @Value("${ecotrack.security.max-sessions-per-user:10}") int maxSessionsPerUser,
            @Value("${ecotrack.security.session-retention-days:30}") long sessionRetentionDays) {
        this.sessionRepository = sessionRepository;
        this.accessTokenTtl = Duration.ofMinutes(accessTokenTtlMinutes);
        this.refreshTokenTtl = Duration.ofDays(refreshTokenTtlDays);
        this.maxSessionsPerUser = maxSessionsPerUser;
        this.sessionRetention = Duration.ofDays(sessionRetentionDays);
    }

    public long getAccessTokenTtlSeconds() {
        return accessTokenTtl.getSeconds();
    }

    /** Result of issuing or rotating a token pair. */
    public record IssuedTokens(Long sessionId, String accessToken, String refreshToken, long expiresInSeconds) {
    }

    /** Result of validating an access token: who it belongs to and which session it came from. */
    public record AuthenticatedSession(Employee employee, Long sessionId) {
    }

    /**
     * Creates a brand-new session (login) for the given employee.
     */
    @Transactional
    public IssuedTokens issueNewSession(Employee employee, String deviceLabel) {
        Instant now = Instant.now();
        String accessToken = generateToken();
        String refreshToken = generateToken();

        Session session = new Session();
        session.setEmployee(employee);
        session.setAccessTokenHash(hash(accessToken));
        session.setAccessTokenExpiresAt(now.plus(accessTokenTtl));
        session.setRefreshTokenHash(hash(refreshToken));
        session.setDeviceLabel(truncate(deviceLabel));
        session.setCreatedAt(now);
        session.setLastUsedAt(now);
        session.setExpiresAt(now.plus(refreshTokenTtl));

        Session saved = sessionRepository.save(session);
        enforceSessionCap(employee.getId(), saved.getId(), now);
        return new IssuedTokens(saved.getId(), accessToken, refreshToken, accessTokenTtl.getSeconds());
    }

    /**
     * Caps how many live sessions one employee can accumulate. Without this,
     * every login adds a 60-day credential that nothing ever cleans up, so a
     * years-old forgotten device stays a valid way into the account. The
     * least-recently-used sessions above the cap are revoked, oldest first.
     */
    private void enforceSessionCap(Long employeeId, Long currentSessionId, Instant now) {
        if (maxSessionsPerUser <= 0) {
            return;
        }
        List<Session> active = sessionRepository
                .findByEmployeeIdAndRevokedAtIsNullOrderByLastUsedAtDesc(employeeId);
        if (active.size() <= maxSessionsPerUser) {
            return;
        }
        for (Session stale : active.subList(maxSessionsPerUser, active.size())) {
            if (stale.getId().equals(currentSessionId)) {
                continue;
            }
            stale.setRevokedAt(now);
            stale.setRevokedReason("SESSION_LIMIT_EXCEEDED");
            sessionRepository.save(stale);
            log.info("Revoked least-recently-used session id={} for employee id={} (cap {} reached)",
                    stale.getId(), employeeId, maxSessionsPerUser);
        }
    }

    /**
     * Rotates a refresh token: the presented token is consumed and a brand
     * new access/refresh pair is issued in its place. Returns empty if the
     * token is unknown, expired or revoked.
     *
     * If the presented token matches a token that was already rotated out
     * (i.e. it is being reused), the whole session is revoked immediately
     * and this returns empty - see the class javadoc.
     */
    @Transactional
    public Optional<IssuedTokens> rotate(String rawRefreshToken, String deviceLabel) {
        String presentedHash = hash(rawRefreshToken);
        Instant now = Instant.now();

        Optional<Session> current = sessionRepository.findByRefreshTokenHash(presentedHash);
        if (current.isPresent()) {
            Session session = current.get();
            if (!session.isActive(now)) {
                return Optional.empty();
            }

            String newAccessToken = generateToken();
            String newRefreshToken = generateToken();

            session.setPreviousTokenHash(session.getRefreshTokenHash());
            session.setRefreshTokenHash(hash(newRefreshToken));
            session.setAccessTokenHash(hash(newAccessToken));
            session.setAccessTokenExpiresAt(now.plus(accessTokenTtl));
            session.setLastUsedAt(now);
            session.setExpiresAt(now.plus(refreshTokenTtl));
            if (deviceLabel != null) {
                session.setDeviceLabel(truncate(deviceLabel));
            }
            sessionRepository.save(session);

            return Optional.of(new IssuedTokens(session.getId(), newAccessToken, newRefreshToken,
                    accessTokenTtl.getSeconds()));
        }

        // Not the current token - was it a token we already rotated away from?
        Optional<Session> reused = sessionRepository.findByPreviousTokenHashAndRevokedAtIsNull(presentedHash);
        if (reused.isPresent()) {
            Session session = reused.get();
            session.setRevokedAt(now);
            session.setRevokedReason("REFRESH_TOKEN_REUSE_DETECTED");
            sessionRepository.save(session);
            log.warn("Refresh token reuse detected for session id={}, employee id={} - session revoked",
                    session.getId(), session.getEmployee().getId());
            return Optional.empty();
        }

        return Optional.empty();
    }

    /**
     * Looks up the employee owning a still-valid access token. Used by the
     * bearer auth filter on every authenticated request.
     */
    @Transactional
    public Optional<AuthenticatedSession> validateAccessToken(String rawAccessToken) {
        if (rawAccessToken == null || rawAccessToken.isBlank()) {
            return Optional.empty();
        }
        String presentedHash = hash(rawAccessToken);
        Instant now = Instant.now();

        return sessionRepository.findByAccessTokenHash(presentedHash)
                // isActive() covers both revocation and the session's own (refresh
                // token) expiry - an access token must never outlive its session,
                // even if its own 30-minute window has not elapsed yet.
                .filter(session -> session.isActive(now))
                .filter(session -> session.getAccessTokenExpiresAt() != null
                        && session.getAccessTokenExpiresAt().isAfter(now))
                .map(session -> {
                    session.setLastUsedAt(now);
                    sessionRepository.save(session);
                    return new AuthenticatedSession(session.getEmployee(), session.getId());
                });
    }

    /** Revokes the session tied to a refresh token (logout). */
    @Transactional
    public void revokeByRefreshToken(String rawRefreshToken) {
        String presentedHash = hash(rawRefreshToken);
        sessionRepository.findByRefreshTokenHash(presentedHash).ifPresent(session -> {
            session.setRevokedAt(Instant.now());
            session.setRevokedReason("LOGOUT");
            sessionRepository.save(session);
        });
    }

    public List<Session> listActiveSessions(Long employeeId) {
        return sessionRepository.findByEmployeeIdAndRevokedAtIsNullOrderByLastUsedAtDesc(employeeId);
    }

    /** Revokes one session belonging to the given employee. Returns false if not found/not theirs. */
    @Transactional
    public boolean revokeSession(Long employeeId, Long sessionId) {
        return sessionRepository.findByIdAndEmployeeId(sessionId, employeeId)
                .map(session -> {
                    session.setRevokedAt(Instant.now());
                    session.setRevokedReason("REVOKED_BY_USER");
                    sessionRepository.save(session);
                    return true;
                })
                .orElse(false);
    }

    /** Revokes every active session for the employee except the current one. */
    @Transactional
    public void revokeAllOtherSessions(Long employeeId, Long currentSessionId) {
        Instant now = Instant.now();
        for (Session session : sessionRepository.findByEmployeeIdAndRevokedAtIsNullOrderByLastUsedAtDesc(employeeId)) {
            if (!session.getId().equals(currentSessionId)) {
                session.setRevokedAt(now);
                session.setRevokedReason("REVOKED_BY_USER");
                sessionRepository.save(session);
            }
        }
    }

    /**
     * Revokes every session an employee has, including the one making the call.
     * Meant for "this account is compromised" / password reset flows.
     */
    @Transactional
    public int revokeAllSessions(Long employeeId, String reason) {
        Instant now = Instant.now();
        int revoked = 0;
        for (Session session : sessionRepository.findByEmployeeIdAndRevokedAtIsNullOrderByLastUsedAtDesc(employeeId)) {
            session.setRevokedAt(now);
            session.setRevokedReason(reason);
            sessionRepository.save(session);
            revoked++;
        }
        return revoked;
    }

    /**
     * Deletes sessions that stopped being usable more than
     * {@code ecotrack.security.session-retention-days} ago (revoked or expired).
     * Keeps the table - and therefore the set of hashes an attacker could ever
     * work with - bounded, and runs nightly rather than on the request path.
     */
    @Scheduled(cron = "${ecotrack.security.session-prune-cron:0 30 3 * * *}")
    @Transactional
    public int pruneStaleSessions() {
        Instant cutoff = Instant.now().minus(sessionRetention);
        int deleted = sessionRepository.deleteStaleSessions(cutoff);
        if (deleted > 0) {
            log.info("Pruned {} session row(s) that became unusable before {}", deleted, cutoff);
        }
        return deleted;
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > MAX_DEVICE_LABEL_LENGTH ? value.substring(0, MAX_DEVICE_LABEL_LENGTH) : value;
    }

    // Public (not just used internally) so tests can compute the hash of a known
    // raw token without duplicating the algorithm.
    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hashed.length * 2);
            for (byte b : hashed) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed to be available on every JVM.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
