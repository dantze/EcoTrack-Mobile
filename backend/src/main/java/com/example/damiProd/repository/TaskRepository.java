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

    List<Task> findByRoute_IdAndStatus(Long routeId, TaskStatus status);

    // Find task by order ID
    Optional<Task> findByOrder_Id(Long orderId);

    // Check if a task exists for an order
    boolean existsByOrder_Id(Long orderId);

    // Find tasks by the route's employee and scheduled time range
    @Query("SELECT t FROM Task t WHERE t.route.employee.id = :employeeId AND t.scheduledTime >= :startOfDay AND t.scheduledTime < :endOfDay ORDER BY t.orderIndex ASC")
    List<Task> findByEmployeeAndScheduledDate(
            @Param("employeeId") Long employeeId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay);

    // Find all tasks belonging to a specific employee (via route)
    List<Task> findByRoute_Employee_IdOrderByOrderIndexAsc(Long employeeId);
}
