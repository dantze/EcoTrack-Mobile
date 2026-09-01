package com.example.damiProd.repository;

import com.example.damiProd.domain.Subscription;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findByIsActiveTrue();

    /**
     * The subscription row, taken with {@code SELECT … FOR UPDATE} (TODO-39).
     *
     * Retiring a plan is a check-then-act: {@code SubscriptionService.deactivate}
     * reads the blockers (live orders, active recurring plans) and only then
     * writes {@code isActive = false}. Under READ COMMITTED nothing makes that
     * pair atomic — a concurrent {@code POST /api/orders} can commit a new
     * unfulfilled IgienizareOrder in between. That transaction never touches the
     * subscriptions row, so with no {@code @Version} and no constraint there is
     * nothing to conflict on, and the plan retires with live work pointing at it.
     *
     * This method is the shared serialisation point. Every writer that can
     * invalidate the other's decision takes it on the SAME row before deciding:
     * the retirement, and the two paths that attach an order to a plan
     * ({@code OrderService} and {@code RecurringIgienizareService}). Whoever gets
     * the lock second sees the other's committed state — either the retirement
     * sees the new order and refuses, or the order creation sees the retired plan
     * and refuses. The lock alone only orders them; the {@code isActive} re-check
     * on the creating side is what turns that order into the invariant.
     *
     * Works on both engines, with one behavioural difference worth knowing:
     * Postgres blocks a waiting locker indefinitely, while H2 (dev and test)
     * gives up after its lock timeout and fails the transaction. A contended
     * retirement therefore surfaces as an error locally and as a wait in prod.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.id = :id")
    Optional<Subscription> findByIdForUpdate(@Param("id") Long id);
}
