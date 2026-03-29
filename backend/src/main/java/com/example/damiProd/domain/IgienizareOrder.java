package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "igienizare_orders")
public class IgienizareOrder extends Order {

    // The sanitation service plan selected by the client
    @ManyToOne
    @JoinColumn(name = "subscription_id")
    private Subscription subscription;

    private String sanitationDate;
    private String sanitationLocationAddress;
    private String sanitationLocationCoordinates; // "lat,long"

    // Link to the recurring plan (null for one-time igienizare orders)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_plan_id")
    @JsonIgnore
    private RecurringIgienizare recurringPlan;

    // Expose recurring plan ID in JSON
    @Transient
    public Long getRecurringPlanId() {
        return recurringPlan != null ? recurringPlan.getId() : null;
    }

    public IgienizareOrder() {
        super();
    }
}
