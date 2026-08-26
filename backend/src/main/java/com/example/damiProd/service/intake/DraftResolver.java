package com.example.damiProd.service.intake;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.OrderDraft;
import com.example.damiProd.domain.Product;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Turns an {@link ExtractedOrder} — text a model copied out of a message — into
 * a draft carrying real foreign keys.
 *
 * This is the half of the pipeline that does not involve a model, and it is
 * where the correctness lives. The split matters: a language model asked to
 * pick a client id will happily produce one that does not exist, or the wrong
 * one, with no signal that it guessed. Matching a name against the actual
 * client table is a string-similarity problem with a definable answer, so it
 * happens here, deterministically, under test.
 *
 * The governing rule is **refuse rather than guess**. Every resolution returns
 * either a confident match or nothing plus a Romanian note explaining what is
 * missing. An unresolved field costs an operator one dropdown; a wrongly
 * resolved one puts a delivery on another company's site.
 */
public class DraftResolver {

    /**
     * Similarity floor for accepting a client match, on the 0..1 scale below.
     *
     * 0.82 is deliberately high. Client names in this business are short and
     * collide easily — "Construct SRL" and "Construct Plus SRL" are different
     * companies with different sites. Below this the draft simply asks the
     * operator to pick, which is a two-second dropdown against the alternative
     * of a truck at the wrong address.
     */
    static final double CLIENT_MATCH_FLOOR = 0.82;

    /** Products are a closed catalogue of ~15, so a looser floor is safe here. */
    static final double PRODUCT_MATCH_FLOOR = 0.55;

    /**
     * @param today injected, never read from the clock, so date resolution is
     *              reproducible and the year-boundary cases are testable
     */
    public OrderDraft resolve(ExtractedOrder extracted, List<Client> clients,
            List<Product> products, LocalDate today) {
        OrderDraft draft = new OrderDraft();
        List<String> notes = new ArrayList<>();

        draft.setOrderType(extracted.orderType());
        if (extracted.orderType() == null) {
            notes.add("Tipul comenzii nu a putut fi dedus — alegeți Amplasare, Ridicare sau Igienizare.");
        }

        draft.setClientNameRaw(extracted.clientName());
        draft.setContactPerson(extracted.contactPerson());
        draft.setContactPhone(extracted.contactPhone());
        draft.setQuantity(extracted.quantity());
        draft.setAddress(extracted.address());
        draft.setCounty(extracted.county());
        draft.setDurationDays(extracted.durationDays());
        draft.setSanitationsPerMonth(extracted.sanitationsPerMonth());
        draft.setConfidence(extracted.confidence());

        resolveClient(extracted.clientName(), clients).ifPresentOrElse(
                client -> draft.setClientId(client.getId()),
                () -> notes.add(extracted.clientName() == null
                        ? "Clientul nu a fost menționat — selectați-l manual."
                        : "Clientul „" + extracted.clientName()
                                + "” nu a fost găsit sigur în baza de date — selectați-l manual."));

        resolveProduct(extracted.productHint(), products).ifPresentOrElse(
                product -> draft.setProductId(product.getId()),
                () -> {
                    if ("Amplasari".equals(extracted.orderType())) {
                        notes.add(extracted.productHint() == null
                                ? "Produsul nu a fost menționat — alegeți din catalog."
                                : "Produsul „" + extracted.productHint()
                                        + "” nu corespunde niciunui articol din catalog.");
                    }
                });

        resolveDate(extracted.startDateExpression(), today, "de început", notes)
                .ifPresent(draft::setStartDate);
        resolveDate(extracted.endDateExpression(), today, "de sfârșit", notes)
                .ifPresent(draft::setEndDate);

        // A duration with a start but no end is complete information; fill the
        // end in rather than making someone do the arithmetic.
        if (draft.getEndDate() == null && draft.getStartDate() != null
                && extracted.durationDays() != null && extracted.durationDays() > 0) {
            draft.setEndDate(draft.getStartDate().plusDays(extracted.durationDays()));
        }

        if (draft.getEndDate() != null && draft.getStartDate() != null
                && draft.getEndDate().isBefore(draft.getStartDate())) {
            notes.add("Data de sfârșit este înaintea celei de început — verificați perioada.");
        }

        if (extracted.quantity() == null && !"Igienizari".equals(extracted.orderType())) {
            notes.add("Cantitatea lipsește.");
        }
        if (extracted.address() == null) {
            notes.add("Adresa lipsește — comanda nu poate fi programată fără ea.");
        }
        if (extracted.notes() != null && !extracted.notes().isBlank()) {
            notes.add(extracted.notes());
        }

        draft.setReviewNotes(notes.isEmpty() ? null : String.join("\n", notes));
        return draft;
    }

    // -----------------------------------------------------------------------
    // Matching
    // -----------------------------------------------------------------------

    Optional<Client> resolveClient(String name, List<Client> clients) {
        if (name == null || name.isBlank() || clients == null) return Optional.empty();
        String needle = RomanianDates.fold(name);
        if (needle.isEmpty()) return Optional.empty();

        record Scored(Client client, double score) {
        }

        List<Scored> ranked = clients.stream()
                .map(client -> new Scored(client, similarity(needle, RomanianDates.fold(displayName(client)))))
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .toList();

        if (ranked.isEmpty()) return Optional.empty();
        Scored best = ranked.get(0);
        if (best.score() < CLIENT_MATCH_FLOOR) return Optional.empty();

        // An ambiguous best is not a match. Two clients scoring within a hair of
        // each other means the name genuinely does not identify one of them, and
        // picking the first is a coin flip with a truck on the line.
        if (ranked.size() > 1 && ranked.get(1).score() >= best.score() - 0.05) {
            return Optional.empty();
        }
        return Optional.of(best.client());
    }

    Optional<Product> resolveProduct(String hint, List<Product> products) {
        if (hint == null || hint.isBlank() || products == null) return Optional.empty();
        String needle = RomanianDates.fold(hint);

        record Scored(Product product, double score) {
        }

        return products.stream()
                .map(product -> new Scored(product, similarity(needle, RomanianDates.fold(product.getName()))))
                .filter(scored -> scored.score() >= PRODUCT_MATCH_FLOOR)
                .max(Comparator.comparingDouble(Scored::score))
                .map(Scored::product);
    }

    private Optional<LocalDate> resolveDate(String expression, LocalDate today,
            String which, List<String> notes) {
        if (expression == null || expression.isBlank()) return Optional.empty();
        Optional<LocalDate> resolved = RomanianDates.resolve(expression, today);
        if (resolved.isEmpty()) {
            notes.add("Data " + which + " („" + expression + "”) nu a putut fi interpretată.");
        }
        return resolved;
    }

    static String displayName(Client client) {
        if (client instanceof Company company) {
            return company.getName() == null ? "" : company.getName();
        }
        if (client instanceof Individual individual) {
            return individual.getFullName() == null ? "" : individual.getFullName();
        }
        return "";
    }

    /**
     * Similarity on 0..1, blending two measures because either alone misreads
     * this domain.
     *
     * Containment handles the common shape: a message says "Construct" and the
     * record is "Construct Alfa SRL". Token overlap handles reordering and the
     * legal-form noise ("SRL", "S.R.L.", "SA") that appears in the database but
     * rarely in a WhatsApp message. Levenshtein alone would score both of those
     * badly and typos well, which is the wrong bias for names people type from
     * memory.
     */
    static double similarity(String left, String right) {
        if (left.isEmpty() || right.isEmpty()) return 0.0;
        if (left.equals(right)) return 1.0;

        double containment = right.contains(left) || left.contains(right)
                ? 0.9 * Math.min(left.length(), right.length()) / (double) Math.max(left.length(), right.length()) + 0.1
                : 0.0;

        var leftTokens = new java.util.HashSet<>(List.of(left.split("[^a-z0-9]+")));
        var rightTokens = new java.util.HashSet<>(List.of(right.split("[^a-z0-9]+")));
        leftTokens.removeIf(String::isEmpty);
        rightTokens.removeIf(String::isEmpty);
        // Legal forms carry no identifying information and appear in almost every
        // company record, so counting them inflates every pair equally.
        List<String> noise = List.of("srl", "sa", "sre", "pfa", "ii", "srls");
        leftTokens.removeAll(noise);
        rightTokens.removeAll(noise);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) return containment;

        var shared = new java.util.HashSet<>(leftTokens);
        shared.retainAll(rightTokens);
        double overlap = shared.size() / (double) Math.max(leftTokens.size(), rightTokens.size());

        return Math.max(containment, overlap);
    }
}
