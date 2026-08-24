package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.ProductController;
import com.example.damiProd.domain.Product;
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
    @Test
    void deleteProduct_shouldReturn409WhenProductInUse() throws Exception {
        doThrow(new IllegalStateException("Nu se poate șterge produsul deoarece este folosit în comenzi existente."))
                .when(productService).deleteProduct(1L);

        mockMvc.perform(delete("/api/products/1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Nu se poate șterge produsul deoarece este folosit în comenzi existente."));
    }
}
