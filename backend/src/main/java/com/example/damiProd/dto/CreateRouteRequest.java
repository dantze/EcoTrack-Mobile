package com.example.damiProd.dto;

import java.time.LocalDate;

public class CreateRouteRequest {
    private LocalDate date;
    private String county;
    private Long employeeId;

    public CreateRouteRequest() {}

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getCounty() {
        return county;
    }

    public void setCounty(String county) {
        this.county = county;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }
}
