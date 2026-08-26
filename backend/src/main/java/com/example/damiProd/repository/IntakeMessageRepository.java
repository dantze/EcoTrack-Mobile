package com.example.damiProd.repository;

import com.example.damiProd.domain.IntakeMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IntakeMessageRepository extends JpaRepository<IntakeMessage, Long> {
    List<IntakeMessage> findByStatusOrderByReceivedAtAsc(IntakeMessage.Status status);
}
