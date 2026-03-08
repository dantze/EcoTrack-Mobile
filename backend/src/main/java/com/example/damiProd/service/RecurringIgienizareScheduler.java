package com.example.damiProd.service;

import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class RecurringIgienizareScheduler {

    private final RecurringIgienizareRepository recurringRepo;
    private final RecurringIgienizareService recurringService;

    public RecurringIgienizareScheduler(RecurringIgienizareRepository recurringRepo,
                                        RecurringIgienizareService recurringService) {
        this.recurringRepo = recurringRepo;
        this.recurringService = recurringService;
    }

    /**
     * Runs daily at 23:59 Bucharest time — generates occurrences for the next 30 days
     * for all active recurring plans.
     */
    @Scheduled(cron = "0 30 23 * * *", zone = "Europe/Bucharest")
    public void generateUpcomingOccurrences() {
        List<RecurringIgienizare> activePlans = recurringRepo.findByActiveTrue();
        LocalDate horizon = LocalDate.now().plusDays(30);

        for (RecurringIgienizare plan : activePlans) {
            try {
                recurringService.generateOccurrences(plan, horizon);
            } catch (Exception e) {
                System.err.println("Failed to generate occurrences for plan " + plan.getId() + ": " + e.getMessage());
            }
        }
    }
}
