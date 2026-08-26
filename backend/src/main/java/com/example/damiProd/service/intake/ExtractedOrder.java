package com.example.damiProd.service.intake;

/**
 * What the language model is asked to return: the facts it can read off an
 * inbound message, and nothing more.
 *
 * Deliberately shallow. Every field is either text copied out of the message or
 * a plain integer — no ids, no resolved dates, no product references. The model
 * is good at "which words in this message are the address"; it is not good at
 * deciding which of 400 clients is meant, or what date "de luni" is, and giving
 * it either job means a hallucinated foreign key or a wrong delivery date that
 * nobody catches. Those resolutions happen afterwards, in {@link DraftResolver},
 * against the real database and under test.
 *
 * `*Expression` fields hold the phrase verbatim ("de luni", "pana pe 15") so
 * {@link RomanianDates} can resolve it deterministically.
 */
public record ExtractedOrder(
        /** "Amplasari" | "Ridicari" | "Igienizari", or null when unclear. */
        String orderType,
        /** Client as named in the message — resolved to an id later, or not at all. */
        String clientName,
        String contactPerson,
        String contactPhone,
        Integer quantity,
        /** Free text like "toalete normale"; matched against the catalogue later. */
        String productHint,
        String address,
        String locality,
        String county,
        String startDateExpression,
        String endDateExpression,
        Integer durationDays,
        Integer sanitationsPerMonth,
        /** Anything the model read that does not fit a field above. */
        String notes,
        /** The model's own 0..1 confidence. Advisory — never a gate on its own. */
        Double confidence) {

    /** An empty extraction, used when the provider is unavailable or declines. */
    public static ExtractedOrder empty() {
        return new ExtractedOrder(null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, 0.0);
    }
}
