package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskType type;

    private LocalDateTime scheduledTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.NEW;

    private String address;
    private String coordinates; // "lat,lng" for map navigation
    private String clientName;
    private String clientPhone;
    private String contactPerson; // On-site contact from order
    private String productName;
    private Integer quantity;
    private String internalNotes;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id")
    @JsonIgnore
    private Route route;

    // Link to the original order
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    @JsonIgnore
    private Order order;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<TaskPhoto> photos = new ArrayList<>();

    // Link to the recurring plan that generated this task (null for order-based tasks)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_plan_id")
    @JsonIgnore
    private RecurringIgienizare recurringPlan;

    // The date this task is scheduled for (used by recurring tasks)
    private LocalDate scheduledDate;

    // Transient field to expose route ID in JSON
    @Transient
    public Long getRouteId() {
        return route != null ? route.getId() : null;
    }

    // Transient field to expose order ID in JSON
    @Transient
    public Long getOrderId() {
        return order != null ? order.getId() : null;
    }

    // Transient field to expose recurring plan ID in JSON
    @Transient
    public Long getRecurringPlanId() {
        return recurringPlan != null ? recurringPlan.getId() : null;
    }

    public Task() {
    }

    public Task(TaskType type, LocalDateTime scheduledTime, String address, String clientName) {
        this.type = type;
        this.scheduledTime = scheduledTime;
        this.address = address;
        this.clientName = clientName;
    }

    public Task(TaskType type, LocalDateTime scheduledTime, String address, String coordinates, String clientName) {
        this.type = type;
        this.scheduledTime = scheduledTime;
        this.address = address;
        this.coordinates = coordinates;
        this.clientName = clientName;
    }
}