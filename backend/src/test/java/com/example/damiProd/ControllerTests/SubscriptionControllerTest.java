package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.SubscriptionController;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.SubscriptionType;
import com.example.damiProd.dto.BlockingOrderRef;
import com.example.damiProd.exception.ResourceInUseException;
import com.example.damiProd.service.SubscriptionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SubscriptionController.class)
// Same reasoning as ProductControllerTest: this slice does not load the app's
// SecurityConfig, so the role matrix is inert here. Auth is covered by the
// @SpringBootTest classes in SecurityTests/.
@AutoConfigureMockMvc(addFilters = false)
class SubscriptionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SubscriptionService subscriptionService;

    private Subscription samplePlan() {
        Subscription sub = new Subscription();
        sub.setId(7L);
        sub.setName("Igienizare lunară");
        sub.setType(SubscriptionType.RECURRING);
        sub.setPrice(199.0);
        return sub;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — GET /api/subscriptions → active plans
    // -----------------------------------------------------------------------
    @Test
    void getActiveSubscriptions_shouldReturn200() throws Exception {
        when(subscriptionService.getActiveSubscriptions()).thenReturn(List.of(samplePlan()));

        mockMvc.perform(get("/api/subscriptions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7))
                .andExpect(jsonPath("$[0].name").value("Igienizare lunară"));
    }

    // -----------------------------------------------------------------------
    // TEST 2 — DELETE succeeds → 204, nothing in the body
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldReturn204WhenNothingBlocks() throws Exception {
        mockMvc.perform(delete("/api/subscriptions/7"))
                .andExpect(status().isNoContent());

        verify(subscriptionService).deactivate(7L);
    }

    // -----------------------------------------------------------------------
    // TEST 3 — DELETE refused → 409 carrying the Romanian message AND the
    //          blocking orders, which is what lets the UI list them.
    // -----------------------------------------------------------------------
    @Test
    void deactivate_shouldReturn409WithBlockingOrders() throws Exception {
        doThrow(new ResourceInUseException(
                "Abonamentul nu poate fi șters: este folosit de 1 comandă nefinalizată.",
                List.of(new BlockingOrderRef(103L, 1003L, "Igienizari", "SC Ecotest SRL", "2026-12-24"))))
                .when(subscriptionService).deactivate(7L);

        mockMvc.perform(delete("/api/subscriptions/7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value(
                        "Abonamentul nu poate fi șters: este folosit de 1 comandă nefinalizată."))
                .andExpect(jsonPath("$.blockingOrders", hasSize(1)))
                .andExpect(jsonPath("$.blockingOrders[0].id").value(103))
                .andExpect(jsonPath("$.blockingOrders[0].number").value(1003))
                .andExpect(jsonPath("$.blockingOrders[0].orderType").value("Igienizari"))
                .andExpect(jsonPath("$.blockingOrders[0].clientName").value("SC Ecotest SRL"))
                .andExpect(jsonPath("$.blockingOrders[0].date").value("2026-12-24"));
    }
}
