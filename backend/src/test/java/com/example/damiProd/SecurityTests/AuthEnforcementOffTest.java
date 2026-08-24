package com.example.damiProd.SecurityTests;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
}
