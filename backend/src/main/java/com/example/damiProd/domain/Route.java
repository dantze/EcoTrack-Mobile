package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.*;
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

    /**
     * 1 = Monday ... 7 = Sunday.
     *
     * A route is WEEKLY, not dated. It describes work that recurs on a given
     * weekday, so editing one changes every week from now on - there is no
     * per-date copy to edit in advance. The old `date` column is gone for
     * exactly that reason: it invited "which Tuesday?" questions the domain
     * has no answer to.
     */
    private Integer dayOfWeek;

    private String county;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = true)
    @JsonIgnore
    private Employee employee;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("route")
    @OrderBy("orderIndex ASC")
    private List<Task> tasks = new ArrayList<>();

    public Route() {
    }

    public Route(String name, Integer dayOfWeek, String county, Employee employee) {
        this.name = name;
        this.dayOfWeek = dayOfWeek;
        this.county = county;
        this.employee = employee;
    }

    // Transient field for JSON serialization
    @Transient
    public Long getEmployeeId() {
        return employee != null ? employee.getId() : null;
    }

    @Transient
    public String getEmployeeName() {
        return employee != null ? employee.getFullName() : null;
    }
}