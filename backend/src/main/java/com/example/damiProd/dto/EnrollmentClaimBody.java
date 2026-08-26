package com.example.damiProd.dto;

/** Body of POST /api/enrollment/claim - the device collecting its approval. */
public class EnrollmentClaimBody {
    private Long requestId;
    private String claimSecret;

    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }
    public String getClaimSecret() { return claimSecret; }
    public void setClaimSecret(String claimSecret) { this.claimSecret = claimSecret; }
}
