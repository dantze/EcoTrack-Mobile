package com.example.damiProd.repository;

import com.example.damiProd.domain.OrderDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderDraftRepository extends JpaRepository<OrderDraft, Long> {

    List<OrderDraft> findByStatusOrderByCreatedAtDesc(OrderDraft.Status status);

    /** The message is LAZY but the review screen always shows it beside the draft. */
    @Query("SELECT d FROM OrderDraft d JOIN FETCH d.message WHERE d.id = :id")
    Optional<OrderDraft> findByIdWithMessage(Long id);

    @Query("SELECT d FROM OrderDraft d JOIN FETCH d.message WHERE d.status = :status "
            + "ORDER BY d.createdAt DESC")
    List<OrderDraft> findByStatusWithMessage(OrderDraft.Status status);

    long countByStatus(OrderDraft.Status status);
}
