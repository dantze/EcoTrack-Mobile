package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "routes")
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate date;
    
    private String county;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = true)
    @JsonIgnore
    private Employee employee;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("route")
    private List<Task> tasks = new ArrayList<>();
    
    // Transient field for JSON serialization
    @Transient
    public Long getEmployeeId() {
        return employee != null ? employee.getId() : null;
    }
    
    @Transient
    public String getEmployeeName() {
        return employee != null ? employee.getFullName() : null;
    }

    // --- Constructori ---
    public Route() {}

    public Route(LocalDate date, Employee employee) {
        this.date = date;
        this.employee = employee;
    }

    // --- Getters și Setters ---
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public Employee getEmployee() {
        return employee;
    }

    public void setEmployee(Employee employee) {
        this.employee = employee;
    }

    public List<Task> getTasks() {
        return tasks;
    }

    public void setTasks(List<Task> tasks) {
        this.tasks = tasks;
    }
}