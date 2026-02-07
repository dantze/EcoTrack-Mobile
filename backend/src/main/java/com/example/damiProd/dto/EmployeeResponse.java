package com.example.damiProd.dto;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;

import java.util.Set;
import java.util.stream.Collectors;

public class EmployeeResponse {
    private Long id;
    private String username;
    private String fullName;
    private String phone;
    private String county;
    private Set<String> roles;

    public EmployeeResponse() {
    }

    public static EmployeeResponse fromEntity(Employee employee) {
        EmployeeResponse response = new EmployeeResponse();
        response.setId(employee.getId());
        response.setUsername(employee.getUsername());
        response.setFullName(employee.getFullName());
        response.setPhone(employee.getPhone());
        response.setCounty(employee.getCounty());
        response.setRoles(
                employee.getRoles().stream()
                        .map(EmployeeRole::getRoleName)
                        .collect(Collectors.toSet()));
        return response;
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
}
