package com.example.damiProd.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import java.util.Date;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;

@Entity
@Getter
@Setter
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private long number;

    private Date date;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    private String orderType;

    // Amplasari Fields
    private Integer quantity;
    private Boolean isIndefinite;
    private Integer durationDays;
    private String startDate;
    private String endDate;
    private String locationCoordinates; // "lat,long"
    private String locationAddress; // Human-readable address string
    private String contact;
    private Integer igienizariPerMonth;
    private String details;

    @ManyToOne
    @JoinColumn(name = "route_definition_id")
    private RouteDefinition routeDefinition;

    public Order() {
    }

    public Order(long number, Date date) {
        this.number = number;
        this.date = date;
    }
}
