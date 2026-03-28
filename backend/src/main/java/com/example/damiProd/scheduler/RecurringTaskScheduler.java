package com.example.damiProd.scheduler;

import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.service.RecurringIgienizareService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Daily scheduler that tops up tasks for active, indefinite recurring plans.
 * Runs at 2:00 AM every day.
 */
@Component
public class RecurringTaskScheduler {

    private final RecurringIgienizareRepository recurringRepo;
    private final RecurringIgienizareService recurringService;

    public RecurringTaskScheduler(RecurringIgienizareRepository recurringRepo,
                                  RecurringIgienizareService recurringService) {
        this.recurringRepo = recurringRepo;
        this.recurringService = recurringService;
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void generateUpcomingTasks() {
        System.out.println("[RecurringTaskScheduler] Running daily task generation...");

        List<RecurringIgienizare> activePlans = recurringRepo.findByActiveTrue();

        int generated = 0;
        for (RecurringIgienizare plan : activePlans) {
            if (plan.getRoute() != null) {
                try {
                    recurringService.generateTasksForPlan(plan);
                    generated++;
                } catch (Exception e) {
                    System.err.println("[RecurringTaskScheduler] Error generating tasks for plan "
                            + plan.getId() + ": " + e.getMessage());
                }
            }
        }

        System.out.println("[RecurringTaskScheduler] Done. Processed " + generated + " plans.");
    }
}
