package com.example.damiProd.domain;

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

    public IgienizareOrder() {
        super();
    }
}
