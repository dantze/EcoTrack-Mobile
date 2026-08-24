package com.example.damiProd.dto;

public class GoogleLoginRequest {
    private String idToken;

    public GoogleLoginRequest() {
    }

    public String getIdToken() {
        return idToken;
    }

    public void setIdToken(String idToken) {
        this.idToken = idToken;
    }
}
