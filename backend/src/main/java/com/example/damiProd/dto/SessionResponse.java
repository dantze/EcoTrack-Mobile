package com.example.damiProd.dto;

import com.example.damiProd.domain.Session;

import java.time.Instant;

public class SessionResponse {
    private Long id;
    private String device;
    private Instant createdAt;
    private Instant lastUsedAt;
    private boolean current;

    public SessionResponse() {
    }

    public static SessionResponse fromEntity(Session session, boolean current) {
        SessionResponse response = new SessionResponse();
        response.setId(session.getId());
        response.setDevice(session.getDeviceLabel());
        response.setCreatedAt(session.getCreatedAt());
        response.setLastUsedAt(session.getLastUsedAt());
        response.setCurrent(current);
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
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

    public boolean isCurrent() {
        return current;
    }

    public void setCurrent(boolean current) {
        this.current = current;
    }
}
