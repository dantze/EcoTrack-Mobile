package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "amplasare_orders")
public class AmplasareOrder extends Order {

    // The physical product (cabin/portable toilet type) being placed
    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    private Integer quantity;
    private Boolean isIndefinite;
    private Integer durationDays;

    private String startDate;
    private String endDate;

    private String locationCoordinates; // "lat,long"
    private String locationAddress; // Human-readable address

    private Integer igienizariPerMonth;

    public AmplasareOrder() {
        super();
    }
}
