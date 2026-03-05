package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Getter
@Setter
@Table(name = "recurring_occurrences")
public class RecurringOccurrence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "recurring_igienizare_id", nullable = false)
    private RecurringIgienizare recurringIgienizare;

    @ManyToOne
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    // The date this specific occurrence was scheduled for
    private LocalDate occurrenceDate;

    public RecurringOccurrence() {
    }
}
