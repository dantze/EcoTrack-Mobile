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

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client LEFT JOIN FETCH o.product LEFT JOIN FETCH o.routeDefinition")
    List<Order> findAllWithClientAndProduct();

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client LEFT JOIN FETCH o.product LEFT JOIN FETCH o.routeDefinition WHERE o.id = :id")
    Optional<Order> findByIdWithClientAndProduct(@Param("id") Long id);

    boolean existsByProductId(Long productId);
}
