package com.example.damiProd.dto;

/**
 * One order that stands in the way of retiring a catalogue entry
 * (a subscription today, potentially a product tomorrow).
 *
 * Carried inside {@link com.example.damiProd.exception.ResourceInUseException}
 * and serialised into the 409 body so the UI can LIST the blockers instead of
 * only telling the user how many there are. Deliberately flat and denormalised
 * — it is an error payload, not an entity view, and it must survive the
 * transaction that produced it.
 */
public record BlockingOrderRef(
        Long id,
        long number,
        String orderType,
        String clientName,
        String date) {
}
