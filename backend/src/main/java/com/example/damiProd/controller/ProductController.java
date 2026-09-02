package com.example.damiProd.controller;

import com.example.damiProd.domain.Product;
import com.example.damiProd.dto.ProductUsageResponse;
import com.example.damiProd.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    /** Active catalogue — what every product picker should show. */
    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts() {
        List<Product> products = productService.getAllProducts();
        return ResponseEntity.ok(products);
    }

    /**
     * Everything, retired products included. Mirrors
     * GET /api/subscriptions/all, for the same reason: a management screen has
     * to be able to see what an old order still points at.
     */
    @GetMapping("/all")
    public ResponseEntity<List<Product>> getEveryProduct() {
        return ResponseEntity.ok(productService.getEveryProduct());
    }

    /**
     * What still uses this product, so the UI can explain a refusal before the
     * operator commits to one (TODO-57). Advisory only - DELETE re-checks.
     *
     * Mirrors GET /api/subscriptions/{id}/usage, down to the shape of the
     * answer, because the two deletes are the same rule. No role row of its own
     * in SecurityConfig: it is a GET under /api/**, which the matrix already
     * limits to authenticated employees, and it exposes nothing a driver could
     * not already read from GET /api/orders.
     */
    @GetMapping("/{id}/usage")
    public ResponseEntity<ProductUsageResponse> usage(@PathVariable Long id) {
        return ResponseEntity.ok(productService.usage(id));
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        Product savedProduct = productService.saveProduct(product);
        return ResponseEntity.ok(savedProduct);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        product.setId(id);
        Product updatedProduct = productService.saveProduct(product);
        return ResponseEntity.ok(updatedProduct);
    }

    /**
     * Soft-delete: marks the product retired, does not remove it.
     *
     * No try/catch here on purpose (TODO-38c). It used to catch
     * IllegalStateException and build its own {@code {"error": ...}} body, which
     * made this the ONE endpoint in the app whose error message lived under a
     * different key — so every client had to special-case it, and the web one
     * silently did not. GlobalExceptionHandler already turns it into a 409 with
     * the message under {@code message}, like everywhere else.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}
