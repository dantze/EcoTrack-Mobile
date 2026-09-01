package com.example.damiProd.repository;

import com.example.damiProd.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * The catalogue as anyone picking a product should see it: everything not
     * retired (TODO-38).
     *
     * <strong>`IS NULL OR = true`, not `isActive = true`.</strong> There is no
     * migration tool - `ddl-auto=update` added is_active to a populated table, so
     * it cannot be NOT NULL and every pre-existing row reads back null. A plain
     * `findByIsActiveTrue()` would therefore return NOTHING on the deploy that
     * introduces the column, emptying every product dropdown in all three apps.
     * Null means active; see Product.isRetired() for the same rule in Java.
     */
    @Query("SELECT p FROM Product p WHERE p.isActive IS NULL OR p.isActive = true")
    List<Product> findAllUsable();
}
