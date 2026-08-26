package com.example.damiProd.service.intake;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The extractor used when no model is configured — and the reason this whole
 * feature is testable and demoable today, with no API key and no network.
 *
 * It is honest about what it is: a set of regexes over the message text. It
 * finds a quantity, guesses the order type from a handful of verbs, spots a
 * phone number and a date phrase, and gives up on everything else. On a tidy
 * message it produces a usable draft; on a rambling one it produces a mostly
 * empty draft with low confidence, which the review screen shows as "needs a
 * human" — the same path a model's low-confidence answer takes.
 *
 * That is the point. The pipeline around it — persistence, resolution against
 * real clients and products, the review-and-accept flow — is identical whichever
 * extractor is wired in, so all of it can be exercised before anyone pays for a
 * token. Swapping in {@link MistralOrderDraftExtractor} is one property.
 *
 * It is NOT a fallback for a failed model call. If Mistral is configured and
 * unreachable, that returns an empty extraction and says so; silently dropping
 * to regexes would hide an outage behind plausible-looking drafts.
 */
public class HeuristicOrderDraftExtractor implements OrderDraftExtractor {

    private static final Logger log = LoggerFactory.getLogger(HeuristicOrderDraftExtractor.class);

    /** Leading digits followed by a unit-ish word, e.g. "3 toalete", "10 cabine". */
    private static final Pattern QUANTITY =
            Pattern.compile("\\b(\\d{1,3})\\s*(toalet|cabin|buc|unitat|wc|bucati)");
    /** Romanian mobile/landline, with or without country code and separators. */
    private static final Pattern PHONE =
            Pattern.compile("(?:\\+?4?0)\\s*7\\d{2}[\\s.-]?\\d{3}[\\s.-]?\\d{3}");
    /** Any phrase RomanianDates has a chance of resolving. */
    private static final Pattern DATE_PHRASE = Pattern.compile(
            "\\b(?:de\\s+|din\\s+|pe\\s+|incepand\\s+cu\\s+)?"
                    + "(azi|astazi|maine|poimaine|luni|marti|miercuri|joi|vineri|sambata|duminica"
                    + "|saptamana viitoare|luna viitoare"
                    + "|peste\\s+\\w+\\s+(?:zile|zi|saptamani|saptamana|luni|luna)"
                    + "|\\d{1,2}\\s+(?:ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august"
                    + "|septembrie|octombrie|noiembrie|decembrie)"
                    + "|\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?)\\b");

    private static final List<String> PLACEMENT_VERBS =
            List.of("nevoie", "trebuie", "amplasare", "montare", "livrare", "aducet", "vrem", "doresc");
    private static final List<String> PICKUP_VERBS =
            List.of("ridicare", "ridicat", "luati", "luat", "strange", "demontare", "gata");
    private static final List<String> SANITATION_VERBS =
            List.of("igienizare", "curatare", "vidanjare", "vidanja", "service", "golire");

    @Override
    public ExtractedOrder extract(String messageText, List<String> catalogue) {
        if (messageText == null || messageText.isBlank()) return ExtractedOrder.empty();

        String folded = RomanianDates.fold(messageText);

        String orderType = orderType(folded);
        Integer quantity = firstInt(QUANTITY, folded);
        String phone = firstMatch(PHONE, messageText);
        String dateExpression = firstMatch(DATE_PHRASE, folded);
        String product = matchCatalogue(folded, catalogue);

        // Deliberately low even on a good parse: a regex has no idea whether it
        // understood the message, and the review screen should treat everything
        // from here as "read this before you accept it".
        double confidence = 0.0;
        if (orderType != null) confidence += 0.2;
        if (quantity != null) confidence += 0.2;
        if (dateExpression != null) confidence += 0.1;

        log.debug("Heuristic extraction: type={} qty={} date={}", orderType, quantity, dateExpression);

        return new ExtractedOrder(
                orderType, null, null, phone, quantity, product,
                null, null, null,
                dateExpression, null, null, null,
                "Extras fără model lingvistic — verificați fiecare câmp.",
                confidence);
    }

    @Override
    public String providerName() {
        return "heuristic";
    }

    private String orderType(String folded) {
        // Pickup and sanitation checked first: "avem nevoie de ridicare" contains
        // a placement verb too, and the more specific noun is the real intent.
        if (containsAny(folded, PICKUP_VERBS)) return "Ridicari";
        if (containsAny(folded, SANITATION_VERBS)) return "Igienizari";
        if (containsAny(folded, PLACEMENT_VERBS)) return "Amplasari";
        return null;
    }

    private boolean containsAny(String text, List<String> needles) {
        return needles.stream().anyMatch(text::contains);
    }

    private String matchCatalogue(String folded, List<String> catalogue) {
        if (catalogue == null) return null;
        return catalogue.stream()
                .filter(name -> folded.contains(RomanianDates.fold(name)))
                .findFirst()
                .orElse(null);
    }

    private String firstMatch(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group().trim() : null;
    }

    private Integer firstInt(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) return null;
        try {
            return Integer.valueOf(matcher.group(1));
        } catch (NumberFormatException malformed) {
            return null;
        }
    }
}
