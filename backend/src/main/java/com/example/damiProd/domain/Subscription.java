package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "subscriptions")
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Display name shown in the app dropdown
    private String name;

    @Column(length = 2000)
    private String description;

    // ONE_TIME = single visit flat fee; RECURRING = monthly fee
    @Enumerated(EnumType.STRING)
    private SubscriptionType type;

    // For ONE_TIME: flat price. For RECURRING: price per month.
    private Double price;

    // Only meaningful for RECURRING — how many visits per month
    private Integer visitsPerMonth;

    // Only meaningful for RECURRING — contract length in months (null if
    // isIndefinite=true)
    private Integer durationMonths;

    // Only meaningful for RECURRING — true = open-ended contract, no fixed end
    private Boolean isIndefinite;

    // Soft-delete flag: false = retired plan, won't appear in new order dropdowns
    private Boolean isActive = true;

    public Subscription() {
    }
}
