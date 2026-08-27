package com.example.damiProd.dto;

public class CreateRouteRequest {
    private String name;
    /** 1 = Monday ... 7 = Sunday. Routes are weekly, never dated. */
    private Integer dayOfWeek;
    private String county;
    private Long employeeId;

    public CreateRouteRequest() {
    }

    public Integer getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(Integer dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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
