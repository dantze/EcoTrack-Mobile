package com.example.damiProd.service.intake;

/**
 * The one place this application talks to a language model.
 *
 * Kept to a single method on purpose. The provider decision (Mistral's hosted
 * API today; a self-hosted model later, if volume or a client contract ever
 * justifies the operational weight) should be a matter of which bean is wired,
 * not a rewrite — so nothing above this interface knows that an LLM exists at
 * all, and nothing below it knows what an Order is.
 *
 * **Contract for every implementation:**
 *
 *  1. Send the message text and the product catalogue. Send NOTHING else from
 *     the database. In particular never send a client record: `Individual.CNP`
 *     is a Romanian national ID, and the extraction task does not need it.
 *     What leaves this network is "3 toalete la Florești de luni", not a person.
 *  2. Never throw. A provider outage, a timeout, a malformed response and a
 *     refusal all return {@link ExtractedOrder#empty()}. An unreachable model
 *     must degrade to "a human types this one in", never to a failed request on
 *     the operator's screen.
 *  3. Never invent. Absent information is null; guessing a quantity is worse
 *     than leaving the field blank for someone to fill in.
 */
public interface OrderDraftExtractor {

    /**
     * @param messageText  raw inbound text — an email body, a WhatsApp message
     * @param catalogue    product names the model may choose between, so it
     *                     cannot invent one that does not exist
     */
    ExtractedOrder extract(String messageText, java.util.List<String> catalogue);

    /** Name of the backing provider, for logging and the drafts UI. */
    String providerName();
}
