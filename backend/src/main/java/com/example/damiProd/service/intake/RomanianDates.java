package com.example.damiProd.service.intake;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns the Romanian date expressions people actually write into real dates.
 *
 * A foreman writes "de luni", "peste doua saptamani", "pe 3 martie" — never an
 * ISO date. Something has to resolve those, and it is deliberately NOT the
 * language model: date arithmetic relative to "today" is exactly the kind of
 * thing an LLM gets subtly wrong (off-by-one weekdays, the wrong year in late
 * December) while sounding completely confident, and a wrong delivery date is a
 * truck on the road for nothing. The model's job is to find the PHRASE; this
 * class turns the phrase into a date, deterministically and under test.
 *
 * Everything is matched diacritic-insensitively, because phones and site
 * offices produce "maine" and "sambata" far more often than "mâine" and
 * "sâmbătă".
 *
 * `today` is always injected rather than read from the clock, so the behaviour
 * is reproducible and the year-boundary cases are testable.
 */
public final class RomanianDates {

    private RomanianDates() {
    }

    private static final Map<String, DayOfWeek> WEEKDAYS = Map.of(
            "luni", DayOfWeek.MONDAY,
            "marti", DayOfWeek.TUESDAY,
            "miercuri", DayOfWeek.WEDNESDAY,
            "joi", DayOfWeek.THURSDAY,
            "vineri", DayOfWeek.FRIDAY,
            "sambata", DayOfWeek.SATURDAY,
            "duminica", DayOfWeek.SUNDAY);

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("ianuarie", 1), Map.entry("februarie", 2), Map.entry("martie", 3),
            Map.entry("aprilie", 4), Map.entry("mai", 5), Map.entry("iunie", 6),
            Map.entry("iulie", 7), Map.entry("august", 8), Map.entry("septembrie", 9),
            Map.entry("octombrie", 10), Map.entry("noiembrie", 11), Map.entry("decembrie", 12));

    /** Spelled-out counts, which are more common than digits for small numbers. */
    private static final Map<String, Integer> NUMERALS = Map.ofEntries(
            Map.entry("o", 1), Map.entry("una", 1), Map.entry("un", 1),
            Map.entry("doua", 2), Map.entry("doi", 2), Map.entry("trei", 3),
            Map.entry("patru", 4), Map.entry("cinci", 5), Map.entry("sase", 6),
            Map.entry("sapte", 7), Map.entry("opt", 8), Map.entry("noua", 9),
            Map.entry("zece", 10));

    private static final Pattern IN_N_UNITS =
            Pattern.compile("\\bpeste\\s+(\\w+)\\s+(zile|zi|saptamani|saptamana|luni|luna)\\b");
    private static final Pattern DAY_MONTH_NAME =
            Pattern.compile("\\b(\\d{1,2})\\s+(" + String.join("|", MONTHS.keySet()) + ")\\b");
    private static final Pattern NUMERIC_DATE =
            Pattern.compile("\\b(\\d{1,2})[./-](\\d{1,2})(?:[./-](\\d{2,4}))?\\b");
    private static final Pattern ISO_DATE = Pattern.compile("\\b(\\d{4})-(\\d{2})-(\\d{2})\\b");

    /**
     * Strips diacritics and lowercases, so "Sâmbătă" and "sambata" are the same
     * token. NFD decomposition then dropping combining marks handles ă/â/î/ș/ț
     * without a hand-written character table.
     */
    public static String fold(String value) {
        if (value == null) return "";
        String decomposed = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
                // ş/ţ with cedilla sometimes arrive as precomposed characters that
                // NFD does not decompose on every JVM; normalise them explicitly.
                .replace('ş', 's').replace('ţ', 't').replace('Ş', 'S').replace('Ţ', 'T')
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    /**
     * Resolves a Romanian date expression against {@code today}.
     *
     * Returns empty rather than guessing — an unparseable phrase leaves the
     * draft field blank and flagged, which a human fixes in two seconds. A
     * wrong date silently accepted is a wasted trip.
     */
    public static Optional<LocalDate> resolve(String expression, LocalDate today) {
        if (expression == null || today == null) return Optional.empty();
        String text = fold(expression);
        if (text.isEmpty()) return Optional.empty();

        // Explicit dates win over everything: if someone wrote a date, use it.
        Optional<LocalDate> explicit = explicitDate(text, today);
        if (explicit.isPresent()) return explicit;

        if (text.contains("poimaine")) return Optional.of(today.plusDays(2));
        if (text.contains("maine")) return Optional.of(today.plusDays(1));
        if (text.contains("azi") || text.contains("astazi")) return Optional.of(today);

        Optional<LocalDate> relative = inNUnits(text, today);
        if (relative.isPresent()) return relative;

        if (text.contains("saptamana viitoare")) {
            // The Monday of next week, not "seven days from now" — "săptămâna
            // viitoare" names a week, and a job filed on Friday for "next week"
            // is not meant for the following Friday.
            return Optional.of(today.plusWeeks(1).with(DayOfWeek.MONDAY));
        }
        if (text.contains("luna viitoare")) {
            return Optional.of(today.plusMonths(1).withDayOfMonth(1));
        }

        return weekday(text, today);
    }

    private static Optional<LocalDate> explicitDate(String text, LocalDate today) {
        Matcher iso = ISO_DATE.matcher(text);
        if (iso.find()) {
            try {
                return Optional.of(LocalDate.parse(iso.group()));
            } catch (DateTimeParseException ignored) {
                return Optional.empty();
            }
        }

        Matcher named = DAY_MONTH_NAME.matcher(text);
        if (named.find()) {
            int day = Integer.parseInt(named.group(1));
            int month = MONTHS.get(named.group(2));
            return atNextOccurrence(today, month, day);
        }

        Matcher numeric = NUMERIC_DATE.matcher(text);
        if (numeric.find()) {
            int day = Integer.parseInt(numeric.group(1));
            int month = Integer.parseInt(numeric.group(2));
            String yearGroup = numeric.group(3);
            if (yearGroup == null) {
                return atNextOccurrence(today, month, day);
            }
            int year = Integer.parseInt(yearGroup);
            if (year < 100) year += 2000;
            return safeDate(year, month, day);
        }

        return Optional.empty();
    }

    /**
     * A day and month with no year means the next time that date comes round.
     * Someone writing "pe 3 martie" on 20 December means next March, and
     * defaulting to the current year would file it nine months in the past.
     */
    private static Optional<LocalDate> atNextOccurrence(LocalDate today, int month, int day) {
        Optional<LocalDate> thisYear = safeDate(today.getYear(), month, day);
        if (thisYear.isPresent() && !thisYear.get().isBefore(today)) return thisYear;
        return safeDate(today.getYear() + 1, month, day);
    }

    private static Optional<LocalDate> safeDate(int year, int month, int day) {
        try {
            return Optional.of(LocalDate.of(year, month, day));
        } catch (java.time.DateTimeException invalid) {
            return Optional.empty();
        }
    }

    private static Optional<LocalDate> inNUnits(String text, LocalDate today) {
        Matcher matcher = IN_N_UNITS.matcher(text);
        if (!matcher.find()) return Optional.empty();

        String countToken = matcher.group(1);
        Integer count = NUMERALS.get(countToken);
        if (count == null) {
            try {
                count = Integer.parseInt(countToken);
            } catch (NumberFormatException notANumber) {
                return Optional.empty();
            }
        }

        String unit = matcher.group(2);
        if (unit.startsWith("zi")) return Optional.of(today.plusDays(count));
        if (unit.startsWith("saptaman")) return Optional.of(today.plusWeeks(count));
        return Optional.of(today.plusMonths(count));
    }

    /**
     * A bare weekday means the NEXT one, never today. "Vine luni" said on a
     * Monday means in seven days — nobody schedules a placement for the day
     * they are describing it as future.
     */
    private static Optional<LocalDate> weekday(String text, LocalDate today) {
        for (Map.Entry<String, DayOfWeek> entry : WEEKDAYS.entrySet()) {
            if (!text.contains(entry.getKey())) continue;
            LocalDate candidate = today.plusDays(1);
            while (candidate.getDayOfWeek() != entry.getValue()) {
                candidate = candidate.plusDays(1);
            }
            return Optional.of(candidate);
        }
        return Optional.empty();
    }
}
