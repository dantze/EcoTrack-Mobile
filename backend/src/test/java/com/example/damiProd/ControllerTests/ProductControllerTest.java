package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.ProductController;
import com.example.damiProd.domain.Product;
import com.example.damiProd.dto.ProductUsageResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.service.ProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProductController.class)
// Security filters are disabled in this slice: this test targets controller/service
// wiring, not auth. @WebMvcTest does not pick up the app's own SecurityConfig, so
// without this the default Spring Boot Security auto-config would 401 everything.
@AutoConfigureMockMvc(addFilters = false)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------
    private Product buildSampleProduct() {
        Product product = new Product("Toaletă Standard", "Cabina ecologică standard", 450.0);
        product.setId(1L);
        return product;
    }

    // -----------------------------------------------------------------------
    // TEST 1 — GET /api/products → all products
    // -----------------------------------------------------------------------
    @Test
    void getAllProducts_shouldReturn200() throws Exception {
        Product product = buildSampleProduct();
        when(productService.getAllProducts()).thenReturn(List.of(product));

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Toaletă Standard"))
                .andExpect(jsonPath("$[0].price").value(450.0));
    }

    // -----------------------------------------------------------------------
    // TEST 2 — POST /api/products → create product
    // -----------------------------------------------------------------------
    @Test
    void createProduct_shouldReturn200() throws Exception {
        Product product = buildSampleProduct();
        when(productService.saveProduct(any(Product.class))).thenReturn(product);

        String body = """
                {
                    "name": "Toaletă Standard",
                    "description": "Cabina ecologică standard",
                    "price": 450.0
                }
                """;

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Toaletă Standard"));
    }

    // -----------------------------------------------------------------------
    // TEST 3 — PUT /api/products/{id} → update product
    // -----------------------------------------------------------------------
    @Test
    void updateProduct_shouldReturn200() throws Exception {
        Product updated = new Product("Toaletă Premium", "Cabina premium cu chiuvetă", 750.0);
        updated.setId(1L);
        when(productService.saveProduct(any(Product.class))).thenReturn(updated);

        String body = """
                {
                    "name": "Toaletă Premium",
                    "description": "Cabina premium cu chiuvetă",
                    "price": 750.0
                }
                """;

        mockMvc.perform(put("/api/products/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Toaletă Premium"))
                .andExpect(jsonPath("$.price").value(750.0));
    }

    // -----------------------------------------------------------------------
    // TEST 4 — DELETE /api/products/{id} → delete product returns 204
    // -----------------------------------------------------------------------
    @Test
    void deleteProduct_shouldReturn204() throws Exception {
        doNothing().when(productService).deleteProduct(1L);

        mockMvc.perform(delete("/api/products/1"))
                .andExpect(status().isNoContent());

        verify(productService).deleteProduct(1L);
    }

    // -----------------------------------------------------------------------
    // TEST 5 — DELETE /api/products/{id} → conflict when product in use
    // -----------------------------------------------------------------------
    /**
     * The refusal now arrives in the app's ONE error shape (TODO-38c).
     *
     * This endpoint used to catch IllegalStateException itself and answer
     * {@code {"error": "<the Romanian text>"}} — the only place in the app where
     * the message lived under `error`. GlobalExceptionHandler puts the status
     * reason there ("Conflict") and the message under `message`, so a client
     * still reading `error` would now show the user the word "Conflict". Both
     * keys are asserted here for exactly that reason.
     */
    @Test
    void deleteProduct_shouldReturn409WhenProductInUse() throws Exception {
        String refusal = "Nu se poate șterge produsul: 2 comenzi nefinalizate îl folosesc încă.";
        doThrow(new IllegalStateException(refusal)).when(productService).deleteProduct(1L);

        mockMvc.perform(delete("/api/products/1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(refusal))
                .andExpect(jsonPath("$.error").value("Conflict"));
    }

    // -----------------------------------------------------------------------
    // TEST 6 — GET /api/products/{id}/usage → the blockers behind that refusal
    // -----------------------------------------------------------------------
    /**
     * The counted refusal above is not answerable on its own (TODO-57): the
     * operator's next question is always WHICH orders. This is the endpoint that
     * answers it, and the fields asserted here are exactly the ones the dialog
     * renders — number, client, type, date — so a row can be labelled and linked
     * without a second call.
     */
    @Test
    void usage_shouldNameTheBlockingOrders() throws Exception {
        when(productService.usage(1L)).thenReturn(new ProductUsageResponse(true, List.of(
                new ProductUsageResponse.BlockingOrder(9L, 41L, "Acme SRL", "Amplasari", "2026-09-14", 3),
                new ProductUsageResponse.BlockingOrder(10L, 42L, "Ana Pop", "Ridicari", null, null))));

        mockMvc.perform(get("/api/products/1/usage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(true))
                .andExpect(jsonPath("$.orders[0].id").value(9))
                .andExpect(jsonPath("$.orders[0].number").value(41))
                .andExpect(jsonPath("$.orders[0].clientName").value("Acme SRL"))
                .andExpect(jsonPath("$.orders[0].orderType").value("Amplasari"))
                .andExpect(jsonPath("$.orders[0].date").value("2026-09-14"))
                .andExpect(jsonPath("$.orders[0].quantity").value(3))
                .andExpect(jsonPath("$.orders[1].orderType").value("Ridicari"))
                .andExpect(jsonPath("$.orders[1].date").doesNotExist());
    }

    @Test
    void usage_shouldReturnNotBlockedWhenNothingUsesTheProduct() throws Exception {
        when(productService.usage(1L)).thenReturn(new ProductUsageResponse(false, List.of()));

        mockMvc.perform(get("/api/products/1/usage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(false))
                .andExpect(jsonPath("$.orders").isEmpty());
    }

    /**
     * An unknown product is a 404, not an empty answer — "nothing uses it" and
     * "there is no such product" must not look the same to the dialog.
     */
    @Test
    void usage_shouldReturn404ForAnUnknownProduct() throws Exception {
        when(productService.usage(9L))
                .thenThrow(new ResourceNotFoundException("Product not found with id: 9"));

        mockMvc.perform(get("/api/products/9/usage"))
                .andExpect(status().isNotFound());
    }
}
