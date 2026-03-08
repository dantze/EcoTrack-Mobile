package com.example.damiProd.repository;

import com.example.damiProd.domain.RecurringOccurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecurringOccurrenceRepository extends JpaRepository<RecurringOccurrence, Long> {
    List<RecurringOccurrence> findByRecurringIgienizareId(Long recurringIgienizareId);
    boolean existsByRecurringIgienizareIdAndOccurrenceDate(Long recurringIgienizareId, LocalDate date);
    Optional<RecurringOccurrence> findByOrderId(Long orderId);
    void deleteByOrderId(Long orderId);
}
