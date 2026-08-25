package com.example.damiProd.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;

/**
 * Verifies Google Sign-In ID tokens server-side.
 *
 * Uses Google's official {@link GoogleIdTokenVerifier}, which validates the
 * token's signature against Google's published JWKS (fetched once and cached
 * in-process per that library's own HTTP caching, not re-fetched per
 * request), plus the issuer, the configured audience (client id) and
 * expiry. We never decode the token ourselves without verifying it first.
 *
 * Configuration ({@code ecotrack.google.*}) comes from application
 * properties / environment, never hardcoded. If no client id is configured,
 * Google sign-in is treated as disabled (fail closed) rather than accepting
 * tokens for any audience.
 */
@Service
public class GoogleAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthService.class);

    private final GoogleIdTokenVerifier verifier;
    private final String allowedDomain;
    private final boolean enabled;

    public GoogleAuthService(
            @Value("${ecotrack.google.client-id:}") String clientId,
            @Value("${ecotrack.google.allowed-domain:}") String allowedDomain) {
        this.allowedDomain = (allowedDomain == null || allowedDomain.isBlank()) ? null : allowedDomain.trim();
        this.enabled = clientId != null && !clientId.isBlank();

        if (enabled) {
            this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId.trim()))
                    .build();
            log.info("Google sign-in enabled (allowedDomain={})", this.allowedDomain == null ? "any" : this.allowedDomain);
        } else {
            this.verifier = null;
            log.warn("Google sign-in disabled: ecotrack.google.client-id is not configured");
        }
    }

    /**
     * Verifies the given ID token. Returns the verified payload only if the
     * signature, issuer, audience and expiry all check out, the email is
     * marked verified by Google, and (when configured) the email's domain
     * matches the allowed domain.
     *
     * Never logs the raw token.
     */
    public Optional<GoogleIdToken.Payload> verify(String idTokenString) {
        if (!enabled) {
            return Optional.empty();
        }
        if (idTokenString == null || idTokenString.isBlank()) {
            return Optional.empty();
        }
        try {
            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                return Optional.empty();
            }
            GoogleIdToken.Payload payload = idToken.getPayload();

            Boolean emailVerified = payload.getEmailVerified();
            if (emailVerified == null || !emailVerified) {
                log.warn("Google login rejected: email not verified by Google");
                return Optional.empty();
            }

            if (allowedDomain != null && !domainMatches(payload)) {
                log.warn("Google login rejected: email domain not in allowed list");
                return Optional.empty();
            }

            return Optional.of(payload);
        } catch (GeneralSecurityException | java.io.IOException | IllegalArgumentException e) {
            log.warn("Google ID token verification failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    // Public (not just used internally) so GoogleAuthServiceTest can exercise the
    // domain-matching rule directly without round-tripping a real signed Google token.
    public boolean domainMatches(GoogleIdToken.Payload payload) {
        if (allowedDomain == null) {
            // No domain restriction configured: verify() never calls this, but a
            // direct caller must not get an NPE (or an accidental "false").
            return true;
        }
        if (payload == null) {
            return false;
        }
        String hostedDomain = payload.getHostedDomain();
        if (hostedDomain != null && hostedDomain.equalsIgnoreCase(allowedDomain)) {
            return true;
        }
        String email = payload.getEmail();
        if (email == null) {
            return false;
        }
        String suffix = "@" + allowedDomain.toLowerCase(Locale.ROOT);
        return email.toLowerCase(Locale.ROOT).endsWith(suffix);
    }
}
