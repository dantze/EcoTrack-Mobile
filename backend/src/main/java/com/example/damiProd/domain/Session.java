package com.example.damiProd.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A single logged-in device/browser for an Employee.
 *
 * Tokens themselves are never persisted - only a SHA-256 hash of each opaque
 * token is stored (see service/TokenService.java), so a stolen database
 * backup cannot be used to forge sessions.
 *
 * Refresh tokens rotate on every use: {@code refreshTokenHash} always holds
 * the hash of the currently-valid refresh token, while {@code previousTokenHash}
 * keeps the hash of the token it replaced. If the previous (already-rotated)
 * token is ever presented again, that is treated as token theft: the whole
 * session is revoked. This is what makes one row a "session family" rather
 * than a single-use record.
 */
@Entity
@Table(name = "sessions")
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "refresh_token_hash", nullable = false, unique = true, length = 64)
    private String refreshTokenHash;

    // Hash of the refresh token this one replaced. Cleared (null) once the
    // rotation window has been consumed by a real refresh, kept only long
    // enough to catch reuse of a stolen, already-rotated token.
    @Column(name = "previous_token_hash", unique = true, length = 64)
    private String previousTokenHash;

    @Column(name = "access_token_hash", unique = true, length = 64)
    private String accessTokenHash;

    @Column(name = "access_token_expires_at")
    private Instant accessTokenExpiresAt;

    // Free-text label built from the User-Agent header at login/refresh time,
    // e.g. "Chrome on Windows" or "EcoTrack Mobile App". Best-effort only.
    @Column(name = "device_label")
    private String deviceLabel;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt;

    // Refresh-token expiry for this session (~60 days from creation/last rotation).
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    // Set only when a session is killed because a rotated-out refresh token
    // was reused (probable theft), as opposed to a normal logout/admin revoke.
    @Column(name = "revoked_reason")
    private String revokedReason;

    public Session() {
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Employee getEmployee() {
        return employee;
    }

    public void setEmployee(Employee employee) {
        this.employee = employee;
    }

    public String getRefreshTokenHash() {
        return refreshTokenHash;
    }

    public void setRefreshTokenHash(String refreshTokenHash) {
        this.refreshTokenHash = refreshTokenHash;
    }

    public String getPreviousTokenHash() {
        return previousTokenHash;
    }

    public void setPreviousTokenHash(String previousTokenHash) {
        this.previousTokenHash = previousTokenHash;
    }

    public String getAccessTokenHash() {
        return accessTokenHash;
    }

    public void setAccessTokenHash(String accessTokenHash) {
        this.accessTokenHash = accessTokenHash;
    }

    public Instant getAccessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public void setAccessTokenExpiresAt(Instant accessTokenExpiresAt) {
        this.accessTokenExpiresAt = accessTokenExpiresAt;
    }

    public String getDeviceLabel() {
        return deviceLabel;
    }

    public void setDeviceLabel(String deviceLabel) {
        this.deviceLabel = deviceLabel;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Instant lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }
}
