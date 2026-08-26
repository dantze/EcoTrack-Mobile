package com.example.damiProd.SecurityTests;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Same real security filter chain as {@link AuthEnforcementOnTest}, but with
 * ecotrack.security.enforce explicitly forced back to false (overriding the
 * "test" profile default) to prove the legacy/mobile-compatible mode still
 * leaves /api/** open to unauthenticated requests, with no token required.
 * This is the mode production currently runs in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "ecotrack.security.enforce=false")
class AuthEnforcementOffTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void anonymousRequestToBusinessEndpoint_isAllowed() throws Exception {
        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousRequestToAdminEndpoint_isAllowed() throws Exception {
        // With enforcement off there is no gate at all on /api/admin/** - the old
        // X-Admin-Key check is gone and the ADMIN-role check only applies once
        // ecotrack.security.enforce=true. This mirrors "every endpoint that works
        // today must still work when enforce=false".
        mockMvc.perform(get("/api/admin/employees"))
                .andExpect(status().isOk());
    }

    @Test
    void meEndpoint_stillRequiresATokenEvenWithEnforcementOff() throws Exception {
        // /api/auth/me is meaningless without a token regardless of the global
        // enforcement flag - it is the auth machinery itself, not a business endpoint.
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requestPresentingAnInvalidBearerToken_isRejectedEvenWithEnforcementOff() throws Exception {
        // Sending NO token is the mobile app's mode and must stay open (above).
        // Sending a token that is expired, revoked or simply wrong is a different
        // thing entirely: honouring it as "anonymous, therefore allowed" would mean
        // a logout or a theft-triggered revocation silently kept working.
        mockMvc.perform(get("/api/employees").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void malformedAuthorizationHeader_isTreatedAsNoTokenAtAll() throws Exception {
        // Not a Bearer scheme - nothing for this filter to validate, so the
        // token-less compatibility mode still applies.
        mockMvc.perform(get("/api/employees").header("Authorization", "Basic dXNlcjpwYXNz"))
                .andExpect(status().isOk());
    }

    @Test
    void h2Console_isDeniedInBothEnforcementModes() throws Exception {
        // The console is an arbitrary-JDBC-URL client and nothing in either client
        // app has ever called it; it is switched off *and* denied at the chain.
        int status = mockMvc.perform(get("/h2-console/")).andReturn().getResponse().getStatus();
        assertThat(status).isIn(401, 403, 404);
    }

    @Test
    void responsesCarryTheApiSecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy",
                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"));
    }

    @Test
    void healthProbe_isReachableWithoutAuthentication() throws Exception {
        // The Docker healthcheck polls this unauthenticated, and docker-compose
        // gates Caddy on the container reporting healthy. When /actuator/health
        // was swallowed by the /actuator/** deny-list it returned 401, the
        // container never became healthy, and the deploy timed out with the
        // reverse proxy never starting.
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    void otherActuatorEndpoints_stayDenied() throws Exception {
        // Only /actuator/health is carved out - the rest of the deny-list holds.
        int status = mockMvc.perform(get("/actuator/env")).andReturn().getResponse().getStatus();
        assertThat(status).isIn(401, 403, 404);
    }
}
