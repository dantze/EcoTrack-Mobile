package com.example.damiProd.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory throttle for POST /api/auth/login, so the endpoint is not a free
 * password-guessing oracle.
 *
 * Two independent counters are kept per attempt:
 *
 *   1. username + client IP - the tight one (default 5 failures). Catches the
 *      ordinary "hammer one account from one box" case quickly.
 *   2. username alone - the one that actually cannot be dodged (default 10
 *      failures). The client IP is taken from X-Forwarded-For when present,
 *      which is caller-controlled unless a trusted proxy rewrites it, so an
 *      attacker can reset counter (1) at will simply by varying that header.
 *      Counter (2) is keyed on something the attacker must hold fixed - the
 *      account they are trying to break into - so distributed/rotating-IP
 *      guessing still trips it.
 *
 * Deliberately NOT keyed on IP alone: production sits behind a single VPS/proxy
 * hop, so one bad actor (or one user fat-fingering their password) would lock
 * out the whole company. The per-username lockout can be abused to deny one
 * known user service for the lockout window - that trade is accepted, it is
 * bounded and it is the standard one.
 *
 * Intentionally not backed by any new infrastructure (no Redis, no eviction
 * thread): the whole app is ~15 employees, a ConcurrentHashMap that prunes
 * itself on write is plenty, and losing the state on restart is acceptable.
 * The map is bounded ({@code max-tracked-keys}) so that a flood of made-up
 * usernames cannot grow it without limit.
 */
@Component
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);

    private static final class Bucket {
        int failureCount;
        Instant windowStart;
        Instant lockedUntil;

        /** A bucket is dead once its window has lapsed and it is no longer locked. */
        boolean isStale(Instant now, Duration window) {
            boolean lockExpired = lockedUntil == null || lockedUntil.isBefore(now);
            boolean windowExpired = windowStart == null || windowStart.plus(window).isBefore(now);
            return lockExpired && windowExpired;
        }
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private final int maxFailures;
    private final int maxFailuresPerUsername;
    private final Duration window;
    private final Duration lockoutDuration;
    private final int maxTrackedKeys;

    public LoginRateLimiter(
            @Value("${ecotrack.security.login-throttle.max-failures:5}") int maxFailures,
            @Value("${ecotrack.security.login-throttle.max-failures-per-username:10}") int maxFailuresPerUsername,
            @Value("${ecotrack.security.login-throttle.window-minutes:15}") long windowMinutes,
            @Value("${ecotrack.security.login-throttle.lockout-minutes:15}") long lockoutMinutes,
            @Value("${ecotrack.security.login-throttle.max-tracked-keys:10000}") int maxTrackedKeys) {
        this.maxFailures = maxFailures;
        this.maxFailuresPerUsername = maxFailuresPerUsername;
        this.window = Duration.ofMinutes(windowMinutes);
        this.lockoutDuration = Duration.ofMinutes(lockoutMinutes);
        this.maxTrackedKeys = maxTrackedKeys;
    }

    private static String normalizeUsername(String username) {
        return username == null ? "?" : username.toLowerCase(Locale.ROOT);
    }

    private String pairKey(String username, String clientIp) {
        return "pair|" + normalizeUsername(username) + "|" + (clientIp == null ? "?" : clientIp);
    }

    private String usernameKey(String username) {
        return "user|" + normalizeUsername(username);
    }

    /** True if either the username+IP pair or the username itself is locked out. */
    public boolean isBlocked(String username, String clientIp) {
        Instant now = Instant.now();
        return isLocked(pairKey(username, clientIp), now) || isLocked(usernameKey(username), now);
    }

    private boolean isLocked(String key, Instant now) {
        Bucket bucket = buckets.get(key);
        if (bucket == null) {
            return false;
        }
        synchronized (bucket) {
            return bucket.lockedUntil != null && bucket.lockedUntil.isAfter(now);
        }
    }

    /** Records a failed login attempt against both counters. */
    public void recordFailure(String username, String clientIp) {
        Instant now = Instant.now();
        pruneIfNeeded(now);
        countFailure(pairKey(username, clientIp), maxFailures, now);
        boolean accountLocked = countFailure(usernameKey(username), maxFailuresPerUsername, now);
        if (accountLocked) {
            // Username only - never the password, never the attempted value.
            log.warn("Login temporarily locked for account '{}' after {} failed attempts",
                    normalizeUsername(username), maxFailuresPerUsername);
        }
    }

    /**
     * @return true if this failure is the one that tripped the lockout.
     */
    private boolean countFailure(String key, int threshold, Instant now) {
        Bucket bucket = buckets.get(key);
        if (bucket == null) {
            if (buckets.size() >= maxTrackedKeys) {
                // Over the cap with nothing prunable: stop tracking *new* keys rather
                // than let a flood of made-up usernames turn this map into the denial
                // of service. Accounts already being tracked stay protected.
                return false;
            }
            bucket = buckets.computeIfAbsent(key, k -> new Bucket());
        }
        // The whole read-modify-write on a bucket happens under its own monitor,
        // so two simultaneous failed logins can never each read "4" and both
        // write "5" - which would let an attacker slip extra guesses past the
        // threshold by firing requests in parallel.
        synchronized (bucket) {
            boolean wasLocked = bucket.lockedUntil != null && bucket.lockedUntil.isAfter(now);
            if (bucket.windowStart == null || bucket.windowStart.plus(window).isBefore(now)) {
                bucket.windowStart = now;
                bucket.failureCount = 0;
            }
            bucket.failureCount++;
            if (bucket.failureCount >= threshold) {
                bucket.lockedUntil = now.plus(lockoutDuration);
                return !wasLocked;
            }
            return false;
        }
    }

    /**
     * Clears throttle state for this key on a successful login. Only the
     * successful pair and account are cleared - a lockout that is already in
     * force is not undone here, because {@link #isBlocked} is checked before the
     * password is ever verified.
     */
    public void recordSuccess(String username, String clientIp) {
        buckets.remove(pairKey(username, clientIp));
        buckets.remove(usernameKey(username));
    }

    /**
     * Drops dead buckets. Called on the failure path only (the success path
     * shrinks the map anyway), and only once the map has grown past the cap, so
     * the common case stays a single hash lookup.
     */
    private void pruneIfNeeded(Instant now) {
        if (buckets.size() < maxTrackedKeys) {
            return;
        }
        Iterator<Map.Entry<String, Bucket>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Bucket bucket = it.next().getValue();
            boolean stale;
            synchronized (bucket) {
                stale = bucket.isStale(now, window);
            }
            if (stale) {
                it.remove();
            }
        }
        if (buckets.size() >= maxTrackedKeys) {
            log.warn("Login throttle is tracking {} live keys (cap {}) - new keys will not be tracked "
                    + "until some expire", buckets.size(), maxTrackedKeys);
        }
    }

    /** Test seam: how many keys are currently tracked. */
    public int trackedKeyCount() {
        return buckets.size();
    }
}
