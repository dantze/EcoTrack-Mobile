package com.example.damiProd.repository;

import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByRoute_Id(Long routeId);

    List<Task> findByRoute_IdOrderByOrderIndexAsc(Long routeId);

    // Find tasks on a route for a specific day (matches either scheduledDate OR scheduledTime within the day)
    @Query("SELECT t FROM Task t WHERE t.route.id = :routeId AND " +
           "(t.scheduledDate = :date OR (t.scheduledTime >= :startOfDay AND t.scheduledTime < :endOfDay)) " +
           "ORDER BY t.orderIndex ASC")
    List<Task> findByRouteAndDay(
            @Param("routeId") Long routeId,
            @Param("date") java.time.LocalDate date,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay);

    List<Task> findByRoute_IdAndStatus(Long routeId, TaskStatus status);

    // Find task by order ID
    Optional<Task> findByOrder_Id(Long orderId);

    // Check if a task exists for an order
    boolean existsByOrder_Id(Long orderId);

    // All tasks belonging to any of the given orders, in one query — used to
    // decide fulfilment for a batch of orders without an N+1 fan-out.
    List<Task> findByOrder_IdIn(java.util.Collection<Long> orderIds);

    // Find tasks by the route's employee and scheduled time range
    @Query("SELECT t FROM Task t WHERE t.route.employee.id = :employeeId AND t.scheduledTime >= :startOfDay AND t.scheduledTime < :endOfDay ORDER BY t.orderIndex ASC")
    List<Task> findByEmployeeAndScheduledDate(
            @Param("employeeId") Long employeeId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay);

    // Find all tasks belonging to a specific employee (via route)
    List<Task> findByRoute_Employee_IdOrderByOrderIndexAsc(Long employeeId);

    // ─── Recurring plan queries ─────────────────────────────────────────
    List<Task> findByRecurringPlan_Id(Long planId);
    boolean existsByRecurringPlan_IdAndScheduledDate(Long planId, java.time.LocalDate scheduledDate);

    // Delete all non-completed tasks for a recurring plan
    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM Task t WHERE t.recurringPlan.id = :planId AND t.status <> 'COMPLETED'")
    void deleteNonCompletedByRecurringPlanId(@Param("planId") Long planId);

    // Delete ALL tasks for a recurring plan (used when deleting the plan entirely)
    void deleteByRecurringPlan_Id(Long planId);
}
