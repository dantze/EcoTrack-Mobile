package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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
    private String clientName;
    private String clientPhone;
    private String internalNotes;

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

    public Task() {
    }

    public Task(TaskType type, LocalDateTime scheduledTime, String address, String clientName) {
        this.type = type;
        this.scheduledTime = scheduledTime;
        this.address = address;
        this.clientName = clientName;
    }
}