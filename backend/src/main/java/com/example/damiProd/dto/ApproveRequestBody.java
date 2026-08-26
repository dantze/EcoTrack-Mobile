package com.example.damiProd.dto;

/** Body of the admin's approve call: which role this person gets. */
public class ApproveRequestBody {
    private String roleName;

    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
}
