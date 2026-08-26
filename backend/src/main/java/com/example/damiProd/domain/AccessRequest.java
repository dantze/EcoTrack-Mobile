package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * One device asking an admin for access.
 *
 * This replaces username/password entirely: nobody registers themselves and
 * there is no credential to guess, phish or share. A device asks, a human with
 * the ADMIN role approves it and picks the role, and only then does the device
 * receive tokens.
 *
 * Three fields carry the security of the flow and are easy to confuse:
 *
 *   deviceId          Client-generated and SELF-ASSERTED. Anyone can send any
 *                     value, so it never grants anything - it exists so the
 *                     admin sees which phone is asking and so a re-install can
 *                     be told apart from a new device.
 *   verificationCode  Shown on the requester's screen AND in the admin list.
 *                     The admin checks they match before approving. This is
 *                     what stops "Ion Popescu" being approved when the real Ion
 *                     is standing somewhere else.
 *   claimSecret       The actual credential. 32 random bytes returned ONCE at
 *                     request time and never again; only its SHA-256 hash is
 *                     stored here, exactly like Session does with tokens. Only
 *                     the device holding it can collect the approved tokens,
 *                     which is what stops an attacker racing to pick up
 *                     somebody else's approval.
 */
@Entity
@Table(name = "access_requests", indexes = {
        @Index(name = "idx_access_request_status", columnList = "status"),
        @Index(name = "idx_access_request_device", columnList = "device_id")
})
@Getter
@Setter
public class AccessRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    /** User agent or model string, for the admin's benefit only. */
    @Column(name = "device_label")
    private String deviceLabel;

    /** SHA-256 of the claim secret. The secret itself is never persisted. */
    @Column(name = "claim_secret_hash", nullable = false, length = 64)
    @JsonIgnore
    private String claimSecretHash;

    @Column(name = "verification_code", nullable = false, length = 8)
    private String verificationCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AccessRequestStatus status = AccessRequestStatus.PENDING;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant decidedAt;

    /** Null for the bootstrap request, which no human approved. */
    @Column(name = "decided_by_employee_id")
    private Long decidedByEmployeeId;

    /** The role the admin granted. Only set once approved. */
    @Column(name = "assigned_role_name", length = 32)
    private String assignedRoleName;

    /** The Employee created when this was claimed. */
    @Column(name = "created_employee_id")
    private Long createdEmployeeId;

    /** A request nobody decided in time is dead even if the row still says PENDING. */
    public boolean isExpiredAt(Instant now) {
        return expiresAt != null && now.isAfter(expiresAt);
    }
}
