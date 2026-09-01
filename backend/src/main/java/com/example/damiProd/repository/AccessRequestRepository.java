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

    /**
     * An approved-but-not-yet-collected grant of a given role, still inside its
     * claim window.
     *
     * Used by EnrollmentService to tell "nobody can get in" apart from "somebody
     * is halfway in": between an ADMIN approval and that device calling /claim
     * there is genuinely no live ADMIN session, but the instance is not locked
     * out - the tokens are one request away. Without this, a normal first run
     * announces a lockout in the seconds before the first admin claims.
     */
    long countByStatusAndAssignedRoleNameAndExpiresAtAfter(
            AccessRequestStatus status, String assignedRoleName, Instant now);
}
