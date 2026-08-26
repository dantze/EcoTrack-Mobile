package com.example.damiProd.config;

import com.example.damiProd.service.intake.HeuristicOrderDraftExtractor;
import com.example.damiProd.service.intake.MistralOrderDraftExtractor;
import com.example.damiProd.service.intake.OrderDraftExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Duration;

/**
 * Chooses which extractor backs the intake pipeline.
 *
 * The presence of an API key is the switch, and nothing else. With a key the
 * Mistral extractor is wired; without one the heuristic extractor runs and the
 * entire feature — receiving messages, extracting, resolving against real
 * clients and products, reviewing, accepting — works end to end with no
 * network call and no account. That is deliberate: the surrounding pipeline is
 * where the bugs live, and it should be exercisable before anyone signs up for
 * anything.
 *
 * Configuration is env-var driven so the key never reaches the repository, and
 * the log line at startup states which one is live — a feature silently running
 * on regexes because a key failed to load is exactly the kind of thing that
 * goes unnoticed for a month.
 */
@Configuration
public class IntakeConfig {

    private static final Logger log = LoggerFactory.getLogger(IntakeConfig.class);

    /**
     * Injected rather than read from the clock inside services, so date
     * resolution ("de luni" against today) is reproducible in tests.
     */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(Clock.class)
    public Clock intakeClock() {
        return Clock.systemDefaultZone();
    }

    @Bean
    public OrderDraftExtractor orderDraftExtractor(
            @Value("${ecotrack.intake.mistral.api-key:}") String apiKey,
            @Value("${ecotrack.intake.mistral.base-url:https://api.mistral.ai}") String baseUrl,
            @Value("${ecotrack.intake.mistral.model:mistral-small-latest}") String model,
            @Value("${ecotrack.intake.mistral.timeout-seconds:30}") long timeoutSeconds,
            ObjectMapper mapper) {

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ecotrack.intake.mistral.api-key is not set — intake is running on the "
                    + "heuristic extractor. Drafts will be sparse and low-confidence. "
                    + "Set MISTRAL_API_KEY to enable model-backed extraction.");
            return new HeuristicOrderDraftExtractor();
        }

        log.info("Intake extraction backed by Mistral (model={}, endpoint={})", model, baseUrl);
        return new MistralOrderDraftExtractor(apiKey, baseUrl, model,
                Duration.ofSeconds(timeoutSeconds), mapper);
    }
}
