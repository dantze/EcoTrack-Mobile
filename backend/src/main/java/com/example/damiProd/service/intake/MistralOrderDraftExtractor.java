package com.example.damiProd.service.intake;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Extraction backed by Mistral's hosted chat-completions API.
 *
 * Mistral rather than a self-hosted model, and rather than a US provider, for
 * three reasons that were weighed rather than assumed: at this volume a hosted
 * API costs a few euros a month against ~€100 for a droplet big enough to serve
 * a 7B model; nobody here has spare capacity to babysit an inference server
 * (the backend is still deployed over SSH with nohup); and Mistral is
 * EU-hosted, so the processor relationship is an ordinary DPA rather than a
 * transfer question. Self-hosting wins later if a client contract forbids
 * third-party processing or volume grows by two orders of magnitude — which is
 * why this class sits behind {@link OrderDraftExtractor} and nothing else knows
 * it exists.
 *
 * **What is sent:** the message text and the product catalogue. Nothing else.
 * No client record, and specifically never `Individual.CNP`. Client resolution
 * happens locally against our own database, after this returns.
 *
 * **Structured output:** `response_format: json_object` plus an explicit schema
 * in the prompt. Mistral does not offer grammar-constrained decoding, so the
 * response is validated on the way back in and a malformed one becomes an empty
 * extraction rather than an exception.
 *
 * This class never throws. See the contract on {@link OrderDraftExtractor}.
 */
public class MistralOrderDraftExtractor implements OrderDraftExtractor {

    private static final Logger log = LoggerFactory.getLogger(MistralOrderDraftExtractor.class);

    private final RestClient http;
    private final ObjectMapper mapper;
    private final String model;

    public MistralOrderDraftExtractor(String apiKey, String baseUrl, String model,
            Duration timeout, ObjectMapper mapper) {
        this.model = model;
        this.mapper = mapper;

        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) timeout.toMillis());
        factory.setReadTimeout((int) timeout.toMillis());

        this.http = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    /**
     * Romanian on purpose: the messages are Romanian, and asking in the target
     * language measurably reduces the model translating field values into
     * English on the way out.
     *
     * Every instruction here exists because of a specific failure mode:
     * "copiază exact" stops it tidying addresses into something ungeocodable;
     * the null rule stops it inventing a quantity of 1; the date rule stops it
     * doing calendar arithmetic, which is {@link RomanianDates}' job; the
     * catalogue rule stops it naming a product we do not sell.
     */
    private static final String SYSTEM_PROMPT = """
            Ești un asistent care extrage date structurate din mesaje primite de o \
            firmă de închiriere toalete ecologice din România (WhatsApp, e-mail, SMS).

            Reguli obligatorii:
            1. Răspunde DOAR cu un obiect JSON valid, fără explicații și fără markdown.
            2. Copiază valorile EXACT cum apar în mesaj. Nu corecta, nu reformula, \
               nu traduce adresele.
            3. Dacă o informație lipsește sau nu e sigură, pune null. NU ghici. \
               Un câmp gol e corect; un câmp inventat e o greșeală costisitoare.
            4. NU calcula date calendaristice. Pentru date, copiază expresia din mesaj \
               ca text ("de luni", "peste doua saptamani", "pe 3 martie"). \
               Conversia se face separat.
            5. Pentru produs, alege exact un nume din catalogul primit sau null. \
               Nu inventa produse.
            6. orderType are exact una din valorile: "Amplasari" (livrare/montare), \
               "Ridicari" (ridicare/demontare), "Igienizari" (curățare/vidanjare), \
               sau null.

            Structura JSON (toate câmpurile obligatorii, valoarea poate fi null):
            {
              "orderType": string|null, "clientName": string|null,
              "contactPerson": string|null, "contactPhone": string|null,
              "quantity": number|null, "productHint": string|null,
              "address": string|null, "locality": string|null, "county": string|null,
              "startDateExpression": string|null, "endDateExpression": string|null,
              "durationDays": number|null, "sanitationsPerMonth": number|null,
              "notes": string|null, "confidence": number
            }

            "confidence" este încrederea ta între 0 și 1 că ai înțeles corect mesajul.
            """;

    @Override
    public ExtractedOrder extract(String messageText, List<String> catalogue) {
        if (messageText == null || messageText.isBlank()) return ExtractedOrder.empty();

        String userContent = """
                Catalog de produse disponibile:
                %s

                Mesajul primit:
                \"\"\"
                %s
                \"\"\"
                """.formatted(String.join("\n", catalogue == null ? List.<String>of() : catalogue),
                messageText);

        Map<String, Object> body = Map.of(
                "model", model,
                // Deterministic: this is extraction, not writing. The same message
                // should produce the same draft every time it is retried.
                "temperature", 0,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM_PROMPT),
                        Map.of("role", "user", "content", userContent)));

        try {
            String raw = http.post()
                    .uri("/v1/chat/completions")
                    .body(body)
                    .retrieve()
                    .body(String.class);
            return parse(raw);
        } catch (Exception failure) {
            // Every failure mode lands here on purpose — see the interface
            // contract. An outage must degrade to "type this one in by hand".
            log.warn("Mistral extraction failed ({}); returning an empty draft",
                    failure.getClass().getSimpleName());
            return ExtractedOrder.empty();
        }
    }

    /**
     * Pulls the JSON payload out of the chat envelope and validates it.
     *
     * Tolerant of the two things models do even when told not to: wrapping the
     * object in a ```json fence, and emitting prose around it.
     */
    ExtractedOrder parse(String rawResponse) {
        try {
            var root = mapper.readTree(rawResponse);
            var content = root.path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || !content.isTextual()) return ExtractedOrder.empty();

            String json = stripFence(content.asText());
            var node = mapper.readTree(json);
            if (!node.isObject()) return ExtractedOrder.empty();

            return new ExtractedOrder(
                    normalisedType(text(node, "orderType")),
                    text(node, "clientName"),
                    text(node, "contactPerson"),
                    text(node, "contactPhone"),
                    integer(node, "quantity"),
                    text(node, "productHint"),
                    text(node, "address"),
                    text(node, "locality"),
                    text(node, "county"),
                    text(node, "startDateExpression"),
                    text(node, "endDateExpression"),
                    integer(node, "durationDays"),
                    integer(node, "sanitationsPerMonth"),
                    text(node, "notes"),
                    node.path("confidence").isNumber() ? node.path("confidence").asDouble() : 0.5);
        } catch (Exception malformed) {
            log.warn("Mistral returned an unparseable body; treating as an empty draft");
            return ExtractedOrder.empty();
        }
    }

    private static String stripFence(String value) {
        String trimmed = value.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline) {
                return trimmed.substring(firstNewline + 1, lastFence).trim();
            }
        }
        // Prose around the object: take the outermost braces.
        int open = trimmed.indexOf('{');
        int close = trimmed.lastIndexOf('}');
        if (open >= 0 && close > open) return trimmed.substring(open, close + 1);
        return trimmed;
    }

    /**
     * The discriminators are duplicated in Jackson's `@JsonSubTypes`, the web
     * app and the mobile app; a model answering "amplasare" instead of
     * "Amplasari" must not silently become an unknown type.
     */
    private static String normalisedType(String value) {
        if (value == null) return null;
        String folded = RomanianDates.fold(value);
        if (folded.startsWith("amplas")) return "Amplasari";
        if (folded.startsWith("ridic")) return "Ridicari";
        if (folded.startsWith("igieniz")) return "Igienizari";
        return null;
    }

    private String text(com.fasterxml.jackson.databind.JsonNode node, String field) {
        var value = node.path(field);
        if (!value.isTextual()) return null;
        String trimmed = value.asText().trim();
        // Models emit the string "null" surprisingly often when asked for null.
        if (trimmed.isEmpty() || trimmed.equalsIgnoreCase("null")) return null;
        return trimmed;
    }

    private Integer integer(com.fasterxml.jackson.databind.JsonNode node, String field) {
        var value = node.path(field);
        return value.isNumber() ? value.asInt() : null;
    }

    @Override
    public String providerName() {
        return "mistral:" + model;
    }
}
