package com.example.damiProd.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory throttle for POST /api/auth/login, keyed by
 * username+IP, so the endpoint is not a free password-guessing oracle.
 *
 * Intentionally not backed by any new infrastructure (no Redis, no
 * scheduled eviction thread): the whole app is ~15 employees, so a
 * ConcurrentHashMap that self-prunes on access is plenty, and it resets on
 * every deploy/restart which is acceptable for this use case.
 */
@Component
public class LoginRateLimiter {

    private static final class Bucket {
        int failureCount;
        Instant windowStart;
        Instant lockedUntil;
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private final int maxFailures;
    private final Duration window;
    private final Duration lockoutDuration;

    public LoginRateLimiter(
            @Value("${ecotrack.security.login-throttle.max-failures:5}") int maxFailures,
            @Value("${ecotrack.security.login-throttle.window-minutes:15}") long windowMinutes,
            @Value("${ecotrack.security.login-throttle.lockout-minutes:15}") long lockoutMinutes) {
        this.maxFailures = maxFailures;
        this.window = Duration.ofMinutes(windowMinutes);
        this.lockoutDuration = Duration.ofMinutes(lockoutMinutes);
    }

    private String key(String username, String clientIp) {
        return (username == null ? "?" : username.toLowerCase()) + "|" + (clientIp == null ? "?" : clientIp);
    }

    /** True if this username+IP combo is currently locked out. */
    public boolean isBlocked(String username, String clientIp) {
        Bucket bucket = buckets.get(key(username, clientIp));
        if (bucket == null) {
            return false;
        }
        synchronized (bucket) {
            return bucket.lockedUntil != null && bucket.lockedUntil.isAfter(Instant.now());
        }
    }

    /** Records a failed login attempt, locking the key out once the threshold is hit. */
    public void recordFailure(String username, String clientIp) {
        Bucket bucket = buckets.computeIfAbsent(key(username, clientIp), k -> new Bucket());
        Instant now = Instant.now();
        synchronized (bucket) {
            if (bucket.windowStart == null || bucket.windowStart.plus(window).isBefore(now)) {
                bucket.windowStart = now;
                bucket.failureCount = 0;
            }
            bucket.failureCount++;
            if (bucket.failureCount >= maxFailures) {
                bucket.lockedUntil = now.plus(lockoutDuration);
            }
        }
    }

    /** Clears throttle state for this key on a successful login. */
    public void recordSuccess(String username, String clientIp) {
        buckets.remove(key(username, clientIp));
    }
}
