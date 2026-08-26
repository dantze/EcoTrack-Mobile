package com.example.damiProd.repository;

import com.example.damiProd.domain.AccessRequest;
import com.example.damiProd.domain.AccessRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface AccessRequestRepository extends JpaRepository<AccessRequest, Long> {

    /** The admin dashboard's queue, newest first. */
    List<AccessRequest> findByStatusOrderByCreatedAtDesc(AccessRequestStatus status);

    List<AccessRequest> findByStatusInOrderByCreatedAtDesc(List<AccessRequestStatus> statuses);

    /** Sweeper input: rows still marked live whose window has closed. */
    List<AccessRequest> findByStatusInAndExpiresAtBefore(List<AccessRequestStatus> statuses, Instant cutoff);

    long countByDeviceIdAndCreatedAtAfter(String deviceId, Instant since);
}
