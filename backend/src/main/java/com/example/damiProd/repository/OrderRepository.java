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

    // ─── Deletion guards ────────────────────────────────────────────────────
    //
    // Two different rules, because the two deletes are different operations.
    //
    // A PRODUCT delete is a HARD delete: the row goes away, so ANY order still
    // pointing at it would dangle — finished or not. Both order types that
    // carry a product have to be checked.
    //
    // A SUBSCRIPTION delete is a SOFT delete (isActive = false, see
    // SubscriptionService.deactivate): the row survives and old orders keep
    // resolving through it, so only work that is NOT finished has to block.
    // That is exactly what makes TODO-11's retire-instead-of-delete safe.

    // Used by ProductService to prevent deleting a product still in use
    @Query("SELECT COUNT(o) > 0 FROM AmplasareOrder o WHERE o.product.id = :productId")
    boolean existsByAmplasareOrderProductId(@Param("productId") Long productId);

    @Query("SELECT COUNT(o) > 0 FROM RidicareOrder o WHERE o.product.id = :productId")
    boolean existsByRidicareOrderProductId(@Param("productId") Long productId);

    /**
     * Igienizare orders on this plan whose work is NOT finished yet.
     *
     * "Finished" is deliberately strict: a COMPLETED task, and nothing else. An
     * order with no task at all has certainly not been carried out, so it counts
     * as live even when its date is long past. This is narrower than the web's
     * `deriveLifecycle`, which may call a task-less past-dated order 'done' from
     * its date alone — fine for colouring a map pin, wrong for a guard, which
     * has to fail safe.
     */
    @Query("SELECT o FROM IgienizareOrder o LEFT JOIN FETCH o.client " +
           "WHERE o.subscription.id = :subscriptionId " +
           "AND NOT EXISTS (SELECT t FROM Task t WHERE t.order.id = o.id AND t.status = 'COMPLETED') " +
           "ORDER BY o.number ASC")
    List<IgienizareOrder> findLiveBySubscriptionId(@Param("subscriptionId") Long subscriptionId);

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
