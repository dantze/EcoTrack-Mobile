package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Entity
@Getter
@Setter
@Table(name = "orders")
@Inheritance(strategy = InheritanceType.JOINED)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "orderType", visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = AmplasareOrder.class, name = "Amplasari"),
        @JsonSubTypes.Type(value = RidicareOrder.class, name = "Ridicari"),
        @JsonSubTypes.Type(value = IgienizareOrder.class, name = "Igienizari")
})
public abstract class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private long number;

    private Date date;

    // The type discriminator — stored in DB and used by Jackson for deserialization
    private String orderType;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne
    @JoinColumn(name = "route_definition_id")
    private RouteDefinition routeDefinition;

    // ─── Shared fields (meaningful for all order types) ───
    private String contact; // Contact person on site
    private String details; // Optional free-text notes

    public Order() {
    }

    public Order(long number, Date date) {
        this.number = number;
        this.date = date;
    }
}
