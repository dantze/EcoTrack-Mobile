package com.example.damiProd.SchedulerTests;

import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Route;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.scheduler.RecurringTaskScheduler;
import com.example.damiProd.service.RecurringIgienizareService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The nightly top-up for indefinite recurring plans (CLAUDE.md: "{@code
 * RecurringTaskScheduler} tops up indefinite plans nightly at 02:00").
 *
 * Nobody watches a 02:00 cron job, so the properties that matter are: it only
 * looks at active plans, it skips plans with no route, and — most importantly —
 * ONE broken plan must not stop the rest of the fleet from being scheduled.
 */
@ExtendWith(MockitoExtension.class)
class RecurringTaskSchedulerTest {

    @Mock private RecurringIgienizareRepository recurringRepo;
    @Mock private RecurringIgienizareService recurringService;

    @InjectMocks private RecurringTaskScheduler scheduler;

    private RecurringIgienizare plan(long id, Route route) {
        RecurringIgienizare plan = new RecurringIgienizare();
        plan.setId(id);
        plan.setRoute(route);
        plan.setActive(true);
        plan.setIsIndefinite(true);
        plan.setFrequencyDays(7);
        plan.setStartDate(LocalDate.of(2026, 1, 5));
        return plan;
    }

    private Route route(long id) {
        Route route = new Route();
        route.setId(id);
        route.setName("Ruta " + id);
        return route;
    }

    // -----------------------------------------------------------------------
    // The cron expression itself
    // -----------------------------------------------------------------------

    @Test
    void cronExpression_fires_atTwoAmDaily() throws NoSuchMethodException {
        Scheduled annotation = RecurringTaskScheduler.class
                .getMethod("generateUpcomingTasks")
                .getAnnotation(Scheduled.class);

        assertThat(annotation).isNotNull();

        CronExpression cron = CronExpression.parse(annotation.cron());
        LocalDateTime next = cron.next(LocalDateTime.of(2026, 5, 4, 12, 0));

        assertThat(next).isEqualTo(LocalDateTime.of(2026, 5, 5, 2, 0));
        // and again the following night, i.e. it really is daily
        assertThat(cron.next(next)).isEqualTo(LocalDateTime.of(2026, 5, 6, 2, 0));
    }

    // -----------------------------------------------------------------------
    // Selection
    // -----------------------------------------------------------------------

    @Test
    void onlyActivePlansAreConsidered() {
        // The scheduler never filters on `active` itself — it delegates that to
        // findByActiveTrue(). Pinning the finder choice here stops a refactor to
        // findAll() from silently resurrecting deactivated plans.
        when(recurringRepo.findByActiveTrue()).thenReturn(List.of());

        scheduler.generateUpcomingTasks();

        verify(recurringRepo).findByActiveTrue();
        verify(recurringRepo, never()).findAll();
        verify(recurringService, never()).generateTasksForPlan(any());
    }

    @Test
    void plansWithoutARouteAreSkipped() {
        RecurringIgienizare unassigned = plan(1L, null);
        RecurringIgienizare assigned = plan(2L, route(10L));
        when(recurringRepo.findByActiveTrue()).thenReturn(List.of(unassigned, assigned));

        scheduler.generateUpcomingTasks();

        // A routeless plan has nowhere to hang its tasks; generateTasksForPlan
        // would early-return anyway, but the scheduler must not even try.
        verify(recurringService, never()).generateTasksForPlan(unassigned);
        verify(recurringService).generateTasksForPlan(assigned);
    }

    @Test
    void everyEligiblePlanIsToppedUp() {
        RecurringIgienizare a = plan(1L, route(10L));
        RecurringIgienizare b = plan(2L, route(11L));
        RecurringIgienizare c = plan(3L, route(12L));
        when(recurringRepo.findByActiveTrue()).thenReturn(List.of(a, b, c));

        scheduler.generateUpcomingTasks();

        verify(recurringService).generateTasksForPlan(a);
        verify(recurringService).generateTasksForPlan(b);
        verify(recurringService).generateTasksForPlan(c);
    }

    // -----------------------------------------------------------------------
    // Fault isolation — the property that actually keeps the crew scheduled
    // -----------------------------------------------------------------------

    @Test
    void oneFailingPlanDoesNotAbortTheRestOfTheRun() {
        RecurringIgienizare healthyBefore = plan(1L, route(10L));
        RecurringIgienizare broken = plan(2L, route(11L));
        RecurringIgienizare healthyAfter = plan(3L, route(12L));
        when(recurringRepo.findByActiveTrue())
                .thenReturn(List.of(healthyBefore, broken, healthyAfter));
        doThrow(new RuntimeException("Route not found with id: 11"))
                .when(recurringService).generateTasksForPlan(broken);

        assertThatCode(scheduler::generateUpcomingTasks).doesNotThrowAnyException();

        verify(recurringService).generateTasksForPlan(healthyBefore);
        verify(recurringService).generateTasksForPlan(broken);
        // The one after the failure is the whole point: without the per-plan
        // try/catch, plan 3 would never be generated and a driver would show up
        // to an empty route.
        verify(recurringService).generateTasksForPlan(healthyAfter);
    }

    @Test
    void anEmptyFleetIsANoOpRatherThanAnError() {
        when(recurringRepo.findByActiveTrue()).thenReturn(List.of());

        assertThatCode(scheduler::generateUpcomingTasks).doesNotThrowAnyException();
    }
}
