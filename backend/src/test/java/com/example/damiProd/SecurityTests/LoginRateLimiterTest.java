package com.example.damiProd.SecurityTests;

import com.example.damiProd.service.LoginRateLimiter;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Plain unit test - the throttle is deliberately in-memory (see LoginRateLimiter),
 * so there is nothing to spin a context up for.
 */
class LoginRateLimiterTest {

    /** maxFailures(pair)=3, maxFailuresPerUsername=5, window=15min, lockout=15min, cap=1000. */
    private LoginRateLimiter limiter() {
        return new LoginRateLimiter(3, 5, 15, 15, 1000);
    }

    @Test
    void repeatedFailuresFromOneIp_lockThatUsernameIpPair() {
        LoginRateLimiter limiter = limiter();

        for (int i = 0; i < 3; i++) {
            assertThat(limiter.isBlocked("victim", "1.2.3.4")).isFalse();
            limiter.recordFailure("victim", "1.2.3.4");
        }

        assertThat(limiter.isBlocked("victim", "1.2.3.4")).isTrue();
    }

    @Test
    void rotatingTheClientIp_doesNotBuyUnlimitedGuesses() {
        LoginRateLimiter limiter = limiter();

        // X-Forwarded-For is caller-controlled, so an attacker can present a fresh
        // "IP" for every attempt and never trip the username+IP counter. The
        // per-username counter is the one they cannot dodge.
        for (int i = 0; i < 5; i++) {
            limiter.recordFailure("victim", "10.0.0." + i);
        }

        assertThat(limiter.isBlocked("victim", "10.0.0.99")).isTrue();
        assertThat(limiter.isBlocked("victim", null)).isTrue();
    }

    @Test
    void lockingOneAccount_doesNotLockAnyOtherAccount() {
        LoginRateLimiter limiter = limiter();

        for (int i = 0; i < 6; i++) {
            limiter.recordFailure("victim", "10.0.0." + i);
        }

        assertThat(limiter.isBlocked("victim", "1.2.3.4")).isTrue();
        // Everyone shares one proxy IP in production; locking on IP alone would
        // take the whole company offline. Colleagues must be unaffected.
        assertThat(limiter.isBlocked("colleague", "1.2.3.4")).isFalse();
    }

    @Test
    void usernameMatchingIsCaseInsensitive() {
        LoginRateLimiter limiter = limiter();

        for (int i = 0; i < 5; i++) {
            limiter.recordFailure("Victim", "10.0.0." + i);
        }

        assertThat(limiter.isBlocked("victim", "10.0.0.200")).isTrue();
        assertThat(limiter.isBlocked("VICTIM", "10.0.0.200")).isTrue();
    }

    @Test
    void successClearsBothCountersForThatCaller() {
        LoginRateLimiter limiter = limiter();

        limiter.recordFailure("someone", "1.2.3.4");
        limiter.recordFailure("someone", "1.2.3.4");
        limiter.recordSuccess("someone", "1.2.3.4");

        // Counter restarted from zero: the next two failures must not lock it.
        limiter.recordFailure("someone", "1.2.3.4");
        limiter.recordFailure("someone", "1.2.3.4");
        assertThat(limiter.isBlocked("someone", "1.2.3.4")).isFalse();
    }

    @Test
    void trackedKeysAreBounded_soInventedUsernamesCannotExhaustTheHeap() {
        LoginRateLimiter limiter = new LoginRateLimiter(3, 5, 15, 15, 50);

        for (int i = 0; i < 500; i++) {
            limiter.recordFailure("ghost-" + i, "9.9.9.9");
        }

        assertThat(limiter.trackedKeyCount()).isLessThanOrEqualTo(51);
    }

    @Test
    void unknownCallerIsNotBlockedByDefault() {
        LoginRateLimiter limiter = limiter();

        assertThat(limiter.isBlocked("nobody", "1.2.3.4")).isFalse();
        assertThat(limiter.isBlocked(null, null)).isFalse();
    }
}
