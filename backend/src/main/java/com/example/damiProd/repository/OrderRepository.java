package com.example.damiProd.repository;

import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
    // ONE rule, obeyed by both deletes.
    //
    // Both deletes are the same operation now: a SOFT delete (isActive = false
    // — see SubscriptionService.deactivate and ProductService.deleteProduct).
    // The row survives and old orders keep resolving through it, so only work
    // that is NOT finished has to block. That is what makes TODO-11's
    // retire-instead-of-delete safe.
    //
    // The product half used to be a HARD delete, which forced it to block on ANY
    // reference at all — a product sold once could never leave the catalogue.
    // TODO-38 made it soft; this comment still described the old behaviour until
    // TODO-57 came looking for the orders behind the count.

    // Used by ProductService to prevent deleting a product still in use
    @Query("SELECT COUNT(o) > 0 FROM AmplasareOrder o WHERE o.product.id = :productId")
    boolean existsByAmplasareOrderProductId(@Param("productId") Long productId);

    @Query("SELECT COUNT(o) > 0 FROM RidicareOrder o WHERE o.product.id = :productId")
    boolean existsByRidicareOrderProductId(@Param("productId") Long productId);

    /**
     * Orders using this product whose work is NOT finished yet (TODO-38).
     *
     * The same STRICT rule as {@link #findLiveBySubscriptionId}: unfinished means
     * "has no COMPLETED task", never a date comparison. Both order types that
     * carry a product are counted - missing Ridicari here is the bug that let a
     * pickup-only product be destroyed.
     *
     * This is what a SOFT product delete blocks on. A finished order does not
     * block, because the row survives the delete and the order keeps resolving
     * its product name and price through it.
     */
    @Query("SELECT COUNT(o) FROM Order o "
            + "WHERE ((TYPE(o) = AmplasareOrder AND TREAT(o AS AmplasareOrder).product.id = :productId) "
            + "   OR  (TYPE(o) = RidicareOrder  AND TREAT(o AS RidicareOrder).product.id  = :productId)) "
            + "AND NOT EXISTS (SELECT t FROM Task t WHERE t.order.id = o.id AND t.status = 'COMPLETED')")
    long countLiveByProductId(@Param("productId") Long productId);

    /**
     * The same orders {@link #countLiveByProductId} counts, listed (TODO-57).
     *
     * <strong>The predicate below must stay identical to that one's.</strong>
     * They are the guard and its explanation: the count refuses the delete, this
     * list tells the operator which orders to go and finish. A drift between them
     * shows up as a dialog naming two orders under a refusal that counted three.
     * {@code FulfilmentRuleTest} asserts they agree, case by case, against a real
     * schema.
     *
     * The delete itself stays a COUNT: it runs on every attempt and has no use
     * for the rows.
     */
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.client "
            + "WHERE ((TYPE(o) = AmplasareOrder AND TREAT(o AS AmplasareOrder).product.id = :productId) "
            + "   OR  (TYPE(o) = RidicareOrder  AND TREAT(o AS RidicareOrder).product.id  = :productId)) "
            + "AND NOT EXISTS (SELECT t FROM Task t WHERE t.order.id = o.id AND t.status = 'COMPLETED') "
            + "ORDER BY o.number ASC")
    List<Order> findLiveByProductId(@Param("productId") Long productId);

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

    // ─── Backfill for orders written before numbering existed (TODO-70) ─────
    //
    // `number` is a primitive long, so every order created before TODO-69 was
    // saved as 0. They all render as "#0" on Comenzi and make
    // findLiveBySubscriptionId's `ORDER BY o.number ASC` an ordering over a
    // column of zeroes.
    //
    // `number = id` is not a choice made here — it is the SAME rule
    // OrderService applies to every new order, restated for the rows that
    // predate it. If that rule ever changes, this has to change with it.
    //
    // `WHERE o.number = 0` is what makes it idempotent and therefore safe to
    // run on every boot: rows that already have a number are not touched, and
    // a second run matches nothing.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.number = o.id WHERE o.number = 0")
    int backfillMissingOrderNumbers();

    long countByNumber(long number);
}
