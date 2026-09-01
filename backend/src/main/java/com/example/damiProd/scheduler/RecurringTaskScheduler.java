package com.example.damiProd.scheduler;

import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.service.RecurringIgienizareService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Daily scheduler that tops up tasks for active, indefinite recurring plans.
 * Runs at 2:00 AM every day.
 */
@Component
public class RecurringTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringTaskScheduler.class);

    private final RecurringIgienizareRepository recurringRepo;
    private final RecurringIgienizareService recurringService;

    public RecurringTaskScheduler(RecurringIgienizareRepository recurringRepo,
                                  RecurringIgienizareService recurringService) {
        this.recurringRepo = recurringRepo;
        this.recurringService = recurringService;
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void generateUpcomingTasks() {
        log.info("Running daily task generation");

        List<RecurringIgienizare> activePlans = recurringRepo.findByActiveTrue();

        int generated = 0;
        for (RecurringIgienizare plan : activePlans) {
            if (plan.getRoute() != null) {
                try {
                    recurringService.generateTasksForPlan(plan);
                    generated++;
                } catch (Exception e) {
                    // One plan failing must not stop the fleet (a test pins that),
                    // so this is the only record that it did — at ERROR, with the
                    // stack trace the old stderr line threw away (TODO-25). Nobody
                    // is watching at 02:00; the log is the whole story afterwards.
                    log.error("Could not generate tasks for recurring plan {}", plan.getId(), e);
                }
            }
        }

        log.info("Daily task generation done: {} of {} active plan(s) topped up",
                generated, activePlans.size());
    }
}
