package com.example.damiProd.ServiceTests;

import com.example.damiProd.service.GoogleAuthService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleAuthServiceTest {

    private GoogleIdToken.Payload payloadWithEmail(String email, String hostedDomain) {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setEmail(email);
        if (hostedDomain != null) {
            payload.setHostedDomain(hostedDomain);
        }
        return payload;
    }

    @Test
    void domainMatches_whenHostedDomainClaimMatches_returnsTrue() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "ecotrack.ro");

        boolean matches = service.domainMatches(payloadWithEmail("someone@ecotrack.ro", "ecotrack.ro"));

        assertThat(matches).isTrue();
    }

    @Test
    void domainMatches_whenOnlyEmailSuffixMatches_returnsTrue() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "ecotrack.ro");

        boolean matches = service.domainMatches(payloadWithEmail("someone@ecotrack.ro", null));

        assertThat(matches).isTrue();
    }

    @Test
    void domainMatches_whenDomainDiffers_returnsFalse() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "ecotrack.ro");

        boolean matches = service.domainMatches(payloadWithEmail("someone@gmail.com", null));

        assertThat(matches).isFalse();
    }

    @Test
    void domainMatches_whenNoDomainConfigured_doesNotBlowUpAndImposesNoRestriction() {
        // verify() never calls this when no domain is set, but the method is public
        // and used to dereference a null allowedDomain.
        GoogleAuthService service = new GoogleAuthService("some-client-id", "");

        assertThat(service.domainMatches(payloadWithEmail("someone@gmail.com", null))).isTrue();
    }

    @Test
    void domainMatches_withNoPayload_returnsFalse() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "ecotrack.ro");

        assertThat(service.domainMatches(null)).isFalse();
    }

    @Test
    void domainMatches_lookalikeDomain_isNotAccepted() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "ecotrack.ro");

        assertThat(service.domainMatches(payloadWithEmail("someone@not-ecotrack.ro", null))).isFalse();
        assertThat(service.domainMatches(payloadWithEmail("ecotrack.ro@gmail.com", null))).isFalse();
    }

    @Test
    void verify_whenClientIdNotConfigured_failsClosedRegardlessOfToken() {
        GoogleAuthService service = new GoogleAuthService("", "");

        Optional<GoogleIdToken.Payload> result = service.verify("any-token-value");

        assertThat(result).isEmpty();
    }

    @Test
    void verify_blankOrNullToken_returnsEmptyWithoutThrowing() {
        GoogleAuthService service = new GoogleAuthService("some-client-id", "");

        assertThat(service.verify(null)).isEmpty();
        assertThat(service.verify("")).isEmpty();
        assertThat(service.verify("   ")).isEmpty();
    }
}
