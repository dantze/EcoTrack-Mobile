package com.example.damiProd.RepositoryTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code Task} has THREE independent nullable parents — {@code route_id},
 * {@code order_id} and {@code recurring_plan_id} — each meaning something
 * different (CLAUDE.md). Nothing in the schema stops a task from having all
 * three, one, or none, and the finders are written per-parent, so it is easy
 * to assume a task "belongs to" exactly one thing and be wrong.
 *
 * These tests describe the actual combinations the app produces and what each
 * finder does with them.
 */
@DataJpaTest
class TaskRepositoryTest {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TestEntityManager em;

    private Route routeA;
    private Route routeB;
    private Employee driver;
    private Company acme;

    @BeforeEach
    void seed() {
        driver = em.persist(new Employee("driver1", "Vasile Șofer", "0733"));
        acme = em.persist(new Company("office@acme.ro", "0311", "Bd. 20", "Acme SRL", "RO1", "Maria"));
        routeA = em.persist(new Route("Ruta Nord", 1, "Ilfov", driver));
        routeB = em.persist(new Route("Ruta Sud", 1, "Ilfov", null));
        em.flush();
    }

    private Task task(TaskType type, Route route, com.example.damiProd.domain.Order order,
                      RecurringIgienizare plan, int orderIndex) {
        Task task = new Task();
        task.setType(type);
        task.setStatus(TaskStatus.NEW);
        task.setRoute(route);
        task.setOrder(order);
        task.setRecurringPlan(plan);
        task.setOrderIndex(orderIndex);
        return task;
    }

    private AmplasareOrder anOrder() {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setDate(new Date());
        order.setClient(acme);
        return em.persist(order);
    }

    private RecurringIgienizare aPlan(Route route) {
        RecurringIgienizare plan = new RecurringIgienizare();
        plan.setClient(acme);
        plan.setRoute(route);
        plan.setActive(true);
        plan.setFrequencyDays(7);
        plan.setStartDate(LocalDate.of(2026, 5, 4));
        return em.persist(plan);
    }

    // -----------------------------------------------------------------------
    // The three parents are genuinely independent
    // -----------------------------------------------------------------------

    @Test
    void aTaskCanBePersistedWithAllThreeParentsNull() {
        // Nothing is NOT NULL except type and status: an orphan task is legal.
        Task orphan = taskRepository.save(task(TaskType.PLACEMENT, null, null, null, 0));
        em.flush();
        em.clear();

        Task found = taskRepository.findById(orphan.getId()).orElseThrow();
        assertThat(found.getRouteId()).isNull();
        assertThat(found.getOrderId()).isNull();
        assertThat(found.getRecurringPlanId()).isNull();
    }

    @Test
    void aTaskCanCarryAllThreeParentsAtOnce() {
        // This is not hypothetical: TaskService.createTaskFromOrder saves a task
        // with route+order, then assigns the recurring plan's route, and a plan
        // task on the same route can be topped up alongside it.
        AmplasareOrder order = anOrder();
        RecurringIgienizare plan = aPlan(routeA);
        Task all = taskRepository.save(task(TaskType.SANITIZATION, routeA, order, plan, 0));
        em.flush();
        em.clear();

        Task found = taskRepository.findById(all.getId()).orElseThrow();
        assertThat(found.getRouteId()).isEqualTo(routeA.getId());
        assertThat(found.getOrderId()).isEqualTo(order.getId());
        assertThat(found.getRecurringPlanId()).isEqualTo(plan.getId());

        // and every per-parent finder claims it
        assertThat(taskRepository.findByRoute_Id(routeA.getId())).extracting(Task::getId).contains(all.getId());
        assertThat(taskRepository.findByOrder_Id(order.getId())).isPresent();
        assertThat(taskRepository.findByRecurringPlan_Id(plan.getId())).hasSize(1);
    }

    // -----------------------------------------------------------------------
    // route_id
    // -----------------------------------------------------------------------

    @Test
    void findByRouteIdOrderByOrderIndexAsc_sortsByTheManualDispatchOrder() {
        taskRepository.save(task(TaskType.PLACEMENT, routeA, null, null, 2));
        taskRepository.save(task(TaskType.PICKUP, routeA, null, null, 0));
        taskRepository.save(task(TaskType.SANITIZATION, routeA, null, null, 1));
        taskRepository.save(task(TaskType.PLACEMENT, routeB, null, null, 0));
        em.flush();
        em.clear();

        List<Task> tasks = taskRepository.findByRoute_IdOrderByOrderIndexAsc(routeA.getId());

        assertThat(tasks).hasSize(3);
        assertThat(tasks).extracting(Task::getOrderIndex).containsExactly(0, 1, 2);
    }

    @Test
    void findByRouteIdAndStatus_filtersOnStatus() {
        Task done = task(TaskType.PLACEMENT, routeA, null, null, 0);
        done.setStatus(TaskStatus.COMPLETED);
        taskRepository.save(done);
        taskRepository.save(task(TaskType.PICKUP, routeA, null, null, 1));
        em.flush();
        em.clear();

        assertThat(taskRepository.findByRoute_IdAndStatus(routeA.getId(), TaskStatus.COMPLETED)).hasSize(1);
        assertThat(taskRepository.findByRoute_IdAndStatus(routeA.getId(), TaskStatus.NEW)).hasSize(1);
    }

    /**
     * {@code findByRouteAndDay} deliberately matches EITHER scheduledDate OR a
     * scheduledTime falling inside the day, because recurring tasks set the
     * former and order-derived tasks the latter. Both halves are asserted here.
     */
    @Test
    void findByRouteAndDay_matchesScheduledDateOrScheduledTimeWithinTheDay() {
        LocalDate day = LocalDate.of(2026, 5, 4);

        Task byDate = task(TaskType.SANITIZATION, routeA, null, null, 0);
        byDate.setScheduledDate(day);
        taskRepository.save(byDate);

        Task byTime = task(TaskType.PLACEMENT, routeA, null, null, 1);
        byTime.setScheduledTime(day.atTime(8, 0));
        taskRepository.save(byTime);

        Task nextDay = task(TaskType.PICKUP, routeA, null, null, 2);
        nextDay.setScheduledTime(day.plusDays(1).atTime(8, 0));
        taskRepository.save(nextDay);

        Task unscheduled = task(TaskType.PICKUP, routeA, null, null, 3);
        taskRepository.save(unscheduled);

        em.flush();
        em.clear();

        List<Task> found = taskRepository.findByRouteAndDay(
                routeA.getId(), day, day.atStartOfDay(), day.plusDays(1).atStartOfDay());

        assertThat(found).extracting(Task::getId)
                .containsExactly(byDate.getId(), byTime.getId());
    }

    @Test
    void findByEmployeeAndScheduledDate_reachesTheEmployeeThroughTheRoute() {
        LocalDate day = LocalDate.of(2026, 5, 4);

        Task onDriverRoute = task(TaskType.PLACEMENT, routeA, null, null, 0);
        onDriverRoute.setScheduledTime(day.atTime(9, 30));
        taskRepository.save(onDriverRoute);

        // routeB has no employee: this must not appear, and must not NPE.
        Task onUnassignedRoute = task(TaskType.PLACEMENT, routeB, null, null, 0);
        onUnassignedRoute.setScheduledTime(day.atTime(9, 30));
        taskRepository.save(onUnassignedRoute);

        em.flush();
        em.clear();

        List<Task> found = taskRepository.findByEmployeeAndScheduledDate(
                driver.getId(), day.atStartOfDay(), day.plusDays(1).atStartOfDay());

        assertThat(found).extracting(Task::getId).containsExactly(onDriverRoute.getId());
    }

    /**
     * CURRENT BEHAVIOUR: the employee finders join through {@code t.route}, an
     * INNER join. A task with no route is invisible to the driver's app no
     * matter what — this is why unassigning a route is effectively "hide from
     * the crew" rather than "delete".
     */
    @Test
    void routelessTasksAreInvisibleToEveryEmployeeFinder() {
        Task orphan = task(TaskType.PLACEMENT, null, null, null, 0);
        orphan.setScheduledTime(LocalDateTime.of(2026, 5, 4, 9, 0));
        taskRepository.save(orphan);
        em.flush();
        em.clear();

        assertThat(taskRepository.findByRoute_Employee_IdOrderByOrderIndexAsc(driver.getId())).isEmpty();
        assertThat(taskRepository.findByEmployeeAndScheduledDate(driver.getId(),
                LocalDate.of(2026, 5, 4).atStartOfDay(),
                LocalDate.of(2026, 5, 5).atStartOfDay())).isEmpty();
    }

    // -----------------------------------------------------------------------
    // order_id
    // -----------------------------------------------------------------------

    @Test
    void findAndExistsByOrderId_seeOnlyTheOrderLinkedTask() {
        AmplasareOrder order = anOrder();
        Task linked = taskRepository.save(task(TaskType.PLACEMENT, routeA, order, null, 0));
        taskRepository.save(task(TaskType.PICKUP, routeA, null, null, 1));
        em.flush();
        em.clear();

        assertThat(taskRepository.existsByOrder_Id(order.getId())).isTrue();
        assertThat(taskRepository.findByOrder_Id(order.getId()))
                .get()
                .extracting(Task::getId)
                .isEqualTo(linked.getId());
        assertThat(taskRepository.existsByOrder_Id(999_999L)).isFalse();
        assertThat(taskRepository.findByOrder_Id(999_999L)).isEmpty();
    }

    // -----------------------------------------------------------------------
    // recurring_plan_id
    // -----------------------------------------------------------------------

    @Test
    void existsByRecurringPlanIdAndScheduledDate_isTheIdempotencyGuardForGeneration() {
        RecurringIgienizare plan = aPlan(routeA);
        LocalDate day = LocalDate.of(2026, 6, 1);

        Task generated = task(TaskType.SANITIZATION, routeA, null, plan, 0);
        generated.setScheduledDate(day);
        taskRepository.save(generated);
        em.flush();
        em.clear();

        assertThat(taskRepository.existsByRecurringPlan_IdAndScheduledDate(plan.getId(), day)).isTrue();
        assertThat(taskRepository.existsByRecurringPlan_IdAndScheduledDate(plan.getId(), day.plusDays(7))).isFalse();
    }

    @Test
    void deleteNonCompletedByRecurringPlanId_keepsCompletedHistory() {
        RecurringIgienizare plan = aPlan(routeA);

        Task completed = task(TaskType.SANITIZATION, routeA, null, plan, 0);
        completed.setStatus(TaskStatus.COMPLETED);
        completed.setScheduledDate(LocalDate.of(2026, 6, 1));
        taskRepository.save(completed);

        Task pending = task(TaskType.SANITIZATION, routeA, null, plan, 1);
        pending.setScheduledDate(LocalDate.of(2026, 6, 8));
        taskRepository.save(pending);

        Task inProgress = task(TaskType.SANITIZATION, routeA, null, plan, 2);
        inProgress.setStatus(TaskStatus.IN_PROGRESS);
        inProgress.setScheduledDate(LocalDate.of(2026, 6, 15));
        taskRepository.save(inProgress);

        em.flush();

        taskRepository.deleteNonCompletedByRecurringPlanId(plan.getId());
        em.flush();
        em.clear();

        assertThat(taskRepository.findByRecurringPlan_Id(plan.getId()))
                .singleElement()
                .extracting(Task::getStatus)
                .isEqualTo(TaskStatus.COMPLETED);
    }

    @Test
    void deleteByRecurringPlanId_removesCompletedOnesToo() {
        RecurringIgienizare plan = aPlan(routeA);

        Task completed = task(TaskType.SANITIZATION, routeA, null, plan, 0);
        completed.setStatus(TaskStatus.COMPLETED);
        taskRepository.save(completed);
        taskRepository.save(task(TaskType.SANITIZATION, routeA, null, plan, 1));
        em.flush();

        // OrderService.deleteOrder needs the hard variant to satisfy the FK
        // before the plan row itself goes away.
        taskRepository.deleteByRecurringPlan_Id(plan.getId());
        em.flush();
        em.clear();

        assertThat(taskRepository.findByRecurringPlan_Id(plan.getId())).isEmpty();
    }
}
