package com.example.damiProd.repository;

import com.example.damiProd.domain.IgienizareOrder;
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

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client")
    List<Order> findAllWithClientAndProduct();

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client WHERE o.id = :id")
    Optional<Order> findByIdWithClientAndProduct(@Param("id") Long id);

    // Used by ProductService to prevent deleting a product still in use
    @Query("SELECT COUNT(o) > 0 FROM AmplasareOrder o WHERE o.product.id = :productId")
    boolean existsByAmplasareOrderProductId(@Param("productId") Long productId);

    // Used by SubscriptionService to refuse retiring a plan live orders still
    // use. Igienizare is the only order subtype that references a Subscription.
    // The client is fetched eagerly because the caller builds a blocker list
    // naming the client, and that list outlives the transaction.
    @Query("SELECT o FROM IgienizareOrder o LEFT JOIN FETCH o.client WHERE o.subscription.id = :subscriptionId")
    List<IgienizareOrder> findIgienizareOrdersBySubscriptionId(@Param("subscriptionId") Long subscriptionId);

    // ─── Ridicare availability checks ───────────────────────────────────────
    @Query("SELECT COALESCE(SUM(o.quantity), 0) FROM AmplasareOrder o " +
           "WHERE o.client.id = :clientId AND o.locationCoordinates = :coords AND o.product.name = :productName")
    int sumAmplasareQuantityByClientLocationAndProduct(@Param("clientId") Long clientId,
                                                       @Param("coords") String coords,
                                                       @Param("productName") String productName);

    @Query("SELECT COALESCE(SUM(o.pickupQuantity), 0) FROM RidicareOrder o " +
           "WHERE o.client.id = :clientId AND o.pickupLocationCoordinates = :coords AND o.pickupProductName = :productName")
    int sumRidicareQuantityByClientLocationAndProduct(@Param("clientId") Long clientId,
                                                      @Param("coords") String coords,
                                                      @Param("productName") String productName);
}
