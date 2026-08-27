package com.example.damiProd.repository;

import com.example.damiProd.domain.RecurringIgienizare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecurringIgienizareRepository extends JpaRepository<RecurringIgienizare, Long> {
    List<RecurringIgienizare> findByActiveTrue();
    List<RecurringIgienizare> findByActiveTrueAndRouteIsNull();
    List<RecurringIgienizare> findByClientId(Long clientId);
    List<RecurringIgienizare> findByRoute_Id(Long routeId);

    /**
     * Active plans still pointing at a subscription.
     *
     * These block a retire even harder than an unfinished order does: an active
     * plan keeps GENERATING new orders on that subscription (see
     * RecurringTaskScheduler, nightly at 02:00), so retiring the plan under it
     * would manufacture fresh references to a retired row indefinitely — the
     * dangling this rule exists to prevent.
     */
    List<RecurringIgienizare> findBySubscription_IdAndActiveTrue(Long subscriptionId);
}
