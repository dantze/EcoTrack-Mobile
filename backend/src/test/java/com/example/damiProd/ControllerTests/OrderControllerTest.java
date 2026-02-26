package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.OrderController;
import com.example.damiProd.domain.*;
import com.example.damiProd.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Date;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrderService orderService;

    // -----------------------------------------------------------------------
    // Helper — builds a sample AmplasareOrder linked to a Company client
    // -----------------------------------------------------------------------
    private AmplasareOrder buildSampleAmplasareOrder() {
        Company company = new Company("firma@test.ro", "0722111111", "Str. Firmei 1", "Acme SRL", "RO99999999", "Admin Ion");
        company.setId(1L);

        Product product = new Product("Toaletă Standard", "Cabina standard", 500.0);
        product.setId(10L);

        AmplasareOrder order = new AmplasareOrder();
        order.setId(100L);
        order.setNumber(5001);
        order.setDate(new Date());
        order.setOrderType("Amplasari");
        order.setClient(company);
        order.setProduct(product);
        order.setQuantity(3);
        order.setLocationAddress("Str. Exemplu 10, Cluj");
        order.setStartDate("2025-07-01");
        order.setEndDate("2025-12-01");
        return order;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — POST /api/clients/{clientId}/orders  → create order
    // -----------------------------------------------------------------------
    @Test
    void createOrder_shouldReturn200WithSavedOrder() throws Exception {
        AmplasareOrder order = buildSampleAmplasareOrder();
        when(orderService.createOrder(eq(1L), any(Order.class))).thenReturn(order);

        String body = """
                {
                    "orderType": "Amplasari",
                    "number": 5001,
                    "quantity": 3,
                    "locationAddress": "Str. Exemplu 10, Cluj",
                    "startDate": "2025-07-01",
                    "endDate": "2025-12-01",
                    "product": { "id": 10 }
                }
                """;

        mockMvc.perform(post("/api/clients/1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.orderType").value("Amplasari"))
                .andExpect(jsonPath("$.quantity").value(3));
    }

    // -----------------------------------------------------------------------
    // TEST 2 — GET /api/clients/{clientId}/orders → list orders for a client
    // -----------------------------------------------------------------------
    @Test
    void getOrdersByClient_shouldReturn200WithList() throws Exception {
        AmplasareOrder order = buildSampleAmplasareOrder();
        when(orderService.getOrdersByClient(1L)).thenReturn(List.of(order));

        mockMvc.perform(get("/api/clients/1/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].orderType").value("Amplasari"));
    }

    // -----------------------------------------------------------------------
    // TEST 3 — GET /api/orders → list ALL orders
    // -----------------------------------------------------------------------
    @Test
    void getAllOrders_shouldReturn200WithList() throws Exception {
        AmplasareOrder order = buildSampleAmplasareOrder();
        when(orderService.getAllOrders()).thenReturn(List.of(order));

        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100));
    }

    // -----------------------------------------------------------------------
    // TEST 4 — GET /api/orders/{orderId} → get single order
    // -----------------------------------------------------------------------
    @Test
    void getOrderById_shouldReturn200WithOrder() throws Exception {
        AmplasareOrder order = buildSampleAmplasareOrder();
        when(orderService.getOrderById(100L)).thenReturn(order);

        mockMvc.perform(get("/api/orders/100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.locationAddress").value("Str. Exemplu 10, Cluj"));
    }

    // -----------------------------------------------------------------------
    // TEST 5 — PUT /api/orders/{orderId} → update order
    // -----------------------------------------------------------------------
    @Test
    void updateOrder_shouldReturn200WithUpdatedOrder() throws Exception {
        AmplasareOrder updated = buildSampleAmplasareOrder();
        updated.setQuantity(5);
        updated.setLocationAddress("Str. Nouă 20, București");

        when(orderService.updateOrder(eq(100L), any(Order.class))).thenReturn(updated);

        String body = """
                {
                    "orderType": "Amplasari",
                    "quantity": 5,
                    "locationAddress": "Str. Nouă 20, București"
                }
                """;

        mockMvc.perform(put("/api/orders/100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(5))
                .andExpect(jsonPath("$.locationAddress").value("Str. Nouă 20, București"));
    }

    // -----------------------------------------------------------------------
    // TEST 6 — DELETE /api/orders/{orderId} → delete order returns 204
    // -----------------------------------------------------------------------
    @Test
    void deleteOrder_shouldReturn204() throws Exception {
        doNothing().when(orderService).deleteOrder(100L);

        mockMvc.perform(delete("/api/orders/100"))
                .andExpect(status().isNoContent());

        verify(orderService).deleteOrder(100L);
    }
}
