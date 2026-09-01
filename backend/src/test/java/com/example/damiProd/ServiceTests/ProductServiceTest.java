package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Product;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.service.ProductService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Retiring a product is refused while UNFINISHED orders still use it (TODO-38).
 *
 * The rule changed with the delete. It used to be a HARD delete, so ANY
 * referencing order had to block - which meant a product sold once, years ago,
 * could never leave the catalogue. It is now soft, exactly like a Subscription:
 * the row survives, a finished order keeps resolving through it, and only work
 * that has not happened yet blocks. Getting that backwards in either direction
 * is a real bug - too strict and the catalogue only grows, too loose and a
 * scheduled job loses the product it was going to deliver.
 */
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

        when(productRepository.findAllUsable()).thenReturn(List.of(p1, p2));

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
    // TEST 3 — deleteProduct retires when nothing unfinished uses it
    // -----------------------------------------------------------------------
    private static Product cabin() {
        Product product = new Product("Toaletă Standard", "Standard", 450.0);
        product.setId(1L);
        return product;
    }

    @Test
    void deleteProduct_shouldRetireWhenNothingLiveUsesIt() {
        Product product = cabin();
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(orderRepository.countLiveByProductId(1L)).thenReturn(0L);

        productService.deleteProduct(1L);

        // SOFT: the row survives so FINISHED orders keep resolving through it.
        assertThat(product.isRetired()).isTrue();
        verify(productRepository).save(product);
        verify(productRepository, never()).deleteById(any());
    }

    @Test
    void deleteProduct_shouldNotBlockOnAFinishedOrder() {
        // countLiveByProductId excludes orders with a COMPLETED task, so a
        // product sold years ago can finally leave the catalogue. Under the old
        // hard delete this was the case that made the list grow forever.
        Product product = cabin();
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(orderRepository.countLiveByProductId(1L)).thenReturn(0L);

        productService.deleteProduct(1L);

        assertThat(product.isRetired()).isTrue();
    }

    // -----------------------------------------------------------------------
    // TEST 4 — deleteProduct refuses while unfinished orders use it
    // -----------------------------------------------------------------------
    @Test
    void deleteProduct_shouldThrowWhenAnUnfinishedOrderUsesIt() {
        Product product = cabin();
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(orderRepository.countLiveByProductId(1L)).thenReturn(2L);

        assertThatThrownBy(() -> productService.deleteProduct(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Nu se poate șterge produsul")
                .hasMessageContaining("2 comenzi nefinalizate");

        assertThat(product.isRetired()).isFalse();
        verify(productRepository, never()).save(any());
    }

    @Test
    void deleteProduct_shouldThrowWhenTheProductDoesNotExist() {
        when(productRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.deleteProduct(9L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    /**
     * Romanian counting, same shape as SubscriptionService.blockedMessage().
     * "de" appears once the last two digits reach 20.
     */
    @Test
    void blockedMessage_shouldCountInRomanian() {
        assertThat(ProductService.blockedMessage(1))
                .contains("1 comandă nefinalizată îl folosește încă");
        assertThat(ProductService.blockedMessage(3))
                .contains("3 comenzi nefinalizate îl folosesc încă");
        assertThat(ProductService.blockedMessage(24))
                .contains("24 de comenzi nefinalizate");
    }

    /**
     * A pre-existing row has a NULL is_active, because ddl-auto=update cannot add
     * a NOT NULL column to a populated table. Null MUST read as active, or the
     * deploy that introduced the column empties every product dropdown.
     */
    @Test
    void aNullIsActiveMeansActive() {
        Product legacy = cabin();
        legacy.setIsActive(null);

        assertThat(legacy.isRetired()).isFalse();
    }

    // -----------------------------------------------------------------------
    // TEST 5 — getAllProducts returns empty list
    // -----------------------------------------------------------------------
    @Test
    void getAllProducts_shouldReturnEmptyListWhenNoProducts() {
        when(productRepository.findAllUsable()).thenReturn(List.of());

        List<Product> result = productService.getAllProducts();

        assertThat(result).isEmpty();
    }
}
