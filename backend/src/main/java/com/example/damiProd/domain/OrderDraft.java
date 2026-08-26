package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A proposed order, extracted from an inbound message and waiting for a human.
 *
 * Never becomes an Order on its own. The whole design of this feature is that
 * a machine proposes and a person accepts — the same contract the dispatch
 * board's suggestion cards already use. A draft that auto-created an order
 * would put a truck on the road on the strength of a model's reading of a
 * WhatsApp message, which is not a trade anyone here would take.
 *
 * Resolved foreign keys (`clientId`, `productId`) are nullable and are filled
 * in by {@link com.example.damiProd.service.intake.DraftResolver} matching
 * against real rows — never by the model. Null means "no confident match",
 * which the review screen shows as a field the operator must choose.
 */
@Entity
@Getter
@Setter
@Table(name = "order_drafts")
public class OrderDraft {

    public enum Status {
        /** Extracted, waiting for review. */
        PENDING,
        /** A human turned it into a real order. */
        ACCEPTED,
        /** A human discarded it — spam, duplicate, or not an order at all. */
        REJECTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intake_message_id", nullable = false)
    private IntakeMessage message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.PENDING;

    /** "Amplasari" | "Ridicari" | "Igienizari". Null when the model was unsure. */
    @Column(length = 32)
    private String orderType;

    // --- resolved locally, against real rows -------------------------------
    private Long clientId;
    private Long productId;

    /** What the message called the client, kept even when it resolved. */
    @Column(length = 300)
    private String clientNameRaw;

    private Integer quantity;

    @Column(length = 500)
    private String address;

    @Column(length = 120)
    private String county;

    /** "lat,lng", when the address matched a site this client has used before. */
    @Column(length = 64)
    private String coordinates;

    @Column(length = 120)
    private String contactPerson;

    @Column(length = 64)
    private String contactPhone;

    private LocalDate startDate;
    private LocalDate endDate;
    private Integer durationDays;
    private Integer sanitationsPerMonth;

    /** The model's own confidence, 0..1. Advisory only. */
    private Double confidence;

    /**
     * Romanian, one per line: which fields could not be resolved and why.
     * This is what the review screen shows the operator, and it is the
     * difference between "check this draft" and "check WHAT in this draft".
     */
    @Column(length = 2000)
    private String reviewNotes;

    /** e.g. "mistral:mistral-small-latest" or "heuristic". */
    @Column(length = 64)
    private String provider;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant reviewedAt;

    /** Set once accepted, so a draft can never silently produce two orders. */
    private Long createdOrderId;

    public OrderDraft() {
    }
}
