package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Getter
@Setter
@Table(name = "recurring_igienizari")
public class RecurringIgienizare {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne
    @JoinColumn(name = "subscription_id")
    private Subscription subscription;

    // How often to generate an occurrence (in days): 7, 14, 21, 30
    private Integer frequencyDays;

    private LocalDate startDate;

    // null when isIndefinite = true
    private LocalDate endDate;

    private Boolean isIndefinite = false;

    private String sanitationLocationAddress;
    private String sanitationLocationCoordinates; // "lat,long"

    private String contact;
    private String details;

    // The route to which generated tasks should be assigned (nullable)
    @ManyToOne
    @JoinColumn(name = "route_id")
    private Route route;

    private Boolean active = true;

    public RecurringIgienizare() {
    }
}
