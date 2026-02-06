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

    public void deleteProduct(Long id) {
        // Check if any orders reference this product
        if (orderRepository.existsByProductId(id)) {
            throw new IllegalStateException("Nu se poate șterge produsul deoarece este folosit în comenzi existente.");
        }
        productRepository.deleteById(id);
    }
}
