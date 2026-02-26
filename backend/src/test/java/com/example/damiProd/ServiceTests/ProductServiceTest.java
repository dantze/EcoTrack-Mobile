package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Product;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.service.ProductService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock private ProductRepository productRepository;
    @Mock private OrderRepository orderRepository;

    @InjectMocks
    private ProductService productService;

    // -----------------------------------------------------------------------
    // TEST 1 — getAllProducts
    // -----------------------------------------------------------------------
    @Test
    void getAllProducts_shouldReturnList() {
        Product p1 = new Product("Toaletă Standard", "Standard", 450.0);
        p1.setId(1L);
        Product p2 = new Product("Toaletă Premium", "Premium", 750.0);
        p2.setId(2L);

        when(productRepository.findAll()).thenReturn(List.of(p1, p2));

        List<Product> result = productService.getAllProducts();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("Toaletă Standard");
    }

    // -----------------------------------------------------------------------
    // TEST 2 — saveProduct
    // -----------------------------------------------------------------------
    @Test
    void saveProduct_shouldReturnSavedProduct() {
        Product product = new Product("Toaletă Standard", "Standard cabin", 450.0);
        product.setId(1L);

        when(productRepository.save(any(Product.class))).thenReturn(product);

        Product result = productService.saveProduct(product);

        assertThat(result.getName()).isEqualTo("Toaletă Standard");
        assertThat(result.getPrice()).isEqualTo(450.0);
        verify(productRepository).save(product);
    }

    // -----------------------------------------------------------------------
    // TEST 3 — deleteProduct succeeds when no orders reference it
    // -----------------------------------------------------------------------
    @Test
    void deleteProduct_shouldDeleteWhenNotInUse() {
        when(orderRepository.existsByAmplasareOrderProductId(1L)).thenReturn(false);

        productService.deleteProduct(1L);

        verify(productRepository).deleteById(1L);
    }

    // -----------------------------------------------------------------------
    // TEST 4 — deleteProduct throws when product is used in orders
    // -----------------------------------------------------------------------
    @Test
    void deleteProduct_shouldThrowWhenProductInUse() {
        when(orderRepository.existsByAmplasareOrderProductId(1L)).thenReturn(true);

        assertThatThrownBy(() -> productService.deleteProduct(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Nu se poate șterge produsul");

        verify(productRepository, never()).deleteById(any());
    }

    // -----------------------------------------------------------------------
    // TEST 5 — getAllProducts returns empty list
    // -----------------------------------------------------------------------
    @Test
    void getAllProducts_shouldReturnEmptyListWhenNoProducts() {
        when(productRepository.findAll()).thenReturn(List.of());

        List<Product> result = productService.getAllProducts();

        assertThat(result).isEmpty();
    }
}
