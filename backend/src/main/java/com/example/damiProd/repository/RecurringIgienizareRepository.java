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
}
