package com.example.damiProd.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Table;

@Entity
@Getter
@Setter
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @jakarta.persistence.Column(length = 2000)
    private String description;

    private double price;

    /**
     * Retired-or-not (TODO-38). Deleting a product is a SOFT delete, exactly
     * like a Subscription: the row survives so that finished orders still
     * resolve their product name and price through it.
     *
     * <strong>Nullable, and null MEANS ACTIVE.</strong> There is no migration
     * tool here - `ddl-auto=update` adds the column to a table that already has
     * rows, and it cannot add a NOT NULL column to a populated table. Every row
     * that existed before this field therefore reads back null, and treating
     * that as "retired" would empty the catalogue on the deploy that introduced
     * it. Read it through {@link #isRetired()}, never as a raw boolean, and see
     * ProductRepository.findAllUsable for the query side of the same rule.
     */
    private Boolean isActive;

    public Product() {
        this.isActive = Boolean.TRUE;
    }

    public Product(String name, String description, double price) {
        this();
        this.name = name;
        this.description = description;
        this.price = price;
    }

    /**
     * The only safe way to ask. `Boolean.FALSE.equals` is deliberate: it answers
     * false for null, which is what keeps pre-existing rows in the catalogue.
     */
    public boolean isRetired() {
        return Boolean.FALSE.equals(this.isActive);
    }
}
