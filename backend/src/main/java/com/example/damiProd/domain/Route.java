package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "routes")
@Getter
@Setter
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

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

    public Route() {
    }

    public Route(String name, LocalDate date, Employee employee) {
        this.name = name;
        this.date = date;
        this.employee = employee;
    }
}