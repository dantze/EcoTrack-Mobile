package com.example.damiProd.dto;

/** Body of POST /api/enrollment/request. Public endpoint - assume hostile input. */
public class EnrollmentRequestBody {
    private String fullName;
    private String deviceId;
    private String deviceLabel;
    /** Only used for the very first request on a fresh install. Ignored afterwards. */
    private String setupCode;

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }
    public String getSetupCode() { return setupCode; }
    public void setSetupCode(String setupCode) { this.setupCode = setupCode; }
}
