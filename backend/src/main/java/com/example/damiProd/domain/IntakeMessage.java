package com.example.damiProd.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * An inbound message before anything has been made of it.
 *
 * Stored verbatim and separately from the draft it produced, for two reasons.
 * The review screen shows the original next to the extracted fields, so
 * verifying a draft is a glance rather than a re-reading — that is the single
 * biggest factor in whether people keep trusting the feature. And when the
 * extraction is wrong, the message plus the draft it produced is one labelled
 * example; a few hundred of those are the evaluation set that makes it possible
 * to tell whether a prompt change or a model swap actually helped, instead of
 * tuning by vibes.
 */
@Entity
@Getter
@Setter
@Table(name = "intake_messages")
public class IntakeMessage {

    public enum Source {
        EMAIL, WHATSAPP, SMS, MANUAL
    }

    public enum Status {
        RECEIVED, EXTRACTED, FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Source source = Source.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.RECEIVED;

    /** Phone number, e-mail address or whatever the channel identifies people by. */
    @Column(length = 200)
    private String sender;

    @Column(length = 300)
    private String subject;

    @Column(nullable = false, length = 8000)
    private String body;

    @Column(nullable = false)
    private Instant receivedAt = Instant.now();

    private Instant processedAt;

    public IntakeMessage() {
    }
}
