package com.example.damiProd.service;

import com.example.damiProd.domain.Product;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    public ProductService(ProductRepository productRepository, OrderRepository orderRepository) {
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Product saveProduct(Product product) {
        return productRepository.save(product);
    }

    /**
     * Hard delete, so ANY referencing order blocks — finished or not. Unlike a
     * retired subscription, a deleted product leaves nothing behind for an old
     * order to resolve through.
     *
     * Both order types that carry a product are checked. Ridicari were missed
     * originally: a product used only by a pickup order could be deleted, and
     * the order was left pointing at a row that no longer existed.
     */
    public void deleteProduct(Long id) {
        boolean inUse = orderRepository.existsByAmplasareOrderProductId(id)
                || orderRepository.existsByRidicareOrderProductId(id);
        if (inUse) {
            throw new IllegalStateException("Nu se poate șterge produsul deoarece este folosit în comenzi existente.");
        }
        productRepository.deleteById(id);
    }
}
