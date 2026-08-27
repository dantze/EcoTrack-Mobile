package com.example.damiProd.dto;

import java.util.Set;

// The body of a successful POST /api/enrollment/claim - the only place a
// session is ever handed out. The name predates the removal of password login;
// EnrollmentController is now its sole producer.
//
// NOTE ON SHAPE: the "flat" fields below (id/username/fullName/phone/county/roles)
// are duplicated inside `user` on purpose. The existing mobile app reads the flat
// fields; new web clients should read `user` + the token fields. Do not remove
// the flat fields - both clients are written against this shape.
public class LoginResponse {
    private Long id;
    private String username;
    private String fullName;
    private String phone;
    private String county;
    private Set<String> roles;
    private String message;
    private boolean success;

    // --- Session auth fields (added for real, token-based auth) ---
    private String accessToken;
    private String refreshToken;
    private long expiresIn; // seconds
    private EmployeeResponse user;

    public LoginResponse() {
    }

    public LoginResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public long getExpiresIn() {
        return expiresIn;
    }

    public void setExpiresIn(long expiresIn) {
        this.expiresIn = expiresIn;
    }

    public EmployeeResponse getUser() {
        return user;
    }

    public void setUser(EmployeeResponse user) {
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getCounty() {
        return county;
    }

    public void setCounty(String county) {
        this.county = county;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }
}
