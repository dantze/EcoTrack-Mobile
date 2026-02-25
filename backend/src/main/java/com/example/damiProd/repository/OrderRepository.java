package com.example.damiProd.repository;

import com.example.damiProd.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByClientId(Long clientId);

    List<Order> findByRouteDefinitionId(Long routeDefinitionId);

    // Product is now on subtypes — join only on client & routeDefinition from the
    // base
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client LEFT JOIN FETCH o.routeDefinition")
    List<Order> findAllWithClientAndProduct();

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client LEFT JOIN FETCH o.routeDefinition WHERE o.id = :id")
    Optional<Order> findByIdWithClientAndProduct(@Param("id") Long id);

    boolean existsByRouteDefinitionId(Long routeDefinitionId);

    // Used by ProductService to prevent deleting a product still in use
    @Query("SELECT COUNT(o) > 0 FROM AmplasareOrder o WHERE o.product.id = :productId")
    boolean existsByAmplasareOrderProductId(@Param("productId") Long productId);
}
