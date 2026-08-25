package com.example.damiProd.repository;

import com.example.damiProd.domain.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    Optional<Session> findByRefreshTokenHash(String refreshTokenHash);

    Optional<Session> findByPreviousTokenHashAndRevokedAtIsNull(String previousTokenHash);

    // Employee is a LAZY @ManyToOne on Session; the caller (TokenService#validateAccessToken)
    // hands the resolved Employee to a servlet filter that runs after this method's own
    // transaction has closed, so the proxy must be initialized here via JOIN FETCH rather
    // than lazily on first access (which would throw LazyInitializationException).
    @Query("SELECT s FROM Session s JOIN FETCH s.employee WHERE s.accessTokenHash = :accessTokenHash")
    Optional<Session> findByAccessTokenHash(@Param("accessTokenHash") String accessTokenHash);

    List<Session> findByEmployeeIdAndRevokedAtIsNullOrderByLastUsedAtDesc(Long employeeId);

    Optional<Session> findByIdAndEmployeeId(Long id, Long employeeId);

    /**
     * Deletes sessions that can no longer authenticate anyone and are older than
     * the retention cutoff: revoked before it, or expired before it. Called from
     * TokenService#pruneStaleSessions (nightly), never on a request path.
     */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Session s WHERE (s.revokedAt IS NOT NULL AND s.revokedAt < :cutoff) "
            + "OR s.expiresAt < :cutoff")
    int deleteStaleSessions(@Param("cutoff") Instant cutoff);
}
