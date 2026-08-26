package com.example.damiProd.service;

import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Task;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Row-level access rules for tasks.
 *
 * The role matrix in {@code SecurityConfig} decides which VERBS a role may use
 * ("a DRIVER may PATCH a task status"). It says nothing about WHICH ROWS the
 * caller may touch, so before this class existed any authenticated driver could
 * read {@code /api/tasks/employee/{someoneElse}} or mark another driver's task
 * complete simply by sending a different id. Those are different questions and
 * both have to be answered.
 *
 * The rule: a driver-only employee sees and touches exactly the tasks on routes
 * assigned to them. Office staff (ADMIN/SALES/TECH) are unrestricted, which is
 * the existing overview behaviour and is unchanged.
 *
 * "Driver-only" matters: someone holding DRIVER *and* TECH is office staff who
 * also drives, so the restriction must not apply to them.
 */
@Component
public class TaskAccessPolicy {

    private static final String DRIVER = "DRIVER";
    private static final Set<String> OFFICE = Set.of("ADMIN", "SALES", "TECH");

    /** Romanian, like every other user-facing message. */
    private static final String DENIED = "Nu aveți acces la sarcinile altui angajat";

    /**
     * True when the caller's ONLY role is DRIVER. A driver who also holds an
     * office role is not restricted.
     */
    public boolean isDriverOnly(Employee employee) {
        if (employee == null || employee.getRoles() == null) {
            return false;
        }
        boolean hasDriver = false;
        for (EmployeeRole role : employee.getRoles()) {
            String name = role.getRoleName();
            if (name == null) {
                continue;
            }
            String upper = name.trim().toUpperCase(Locale.ROOT);
            if (OFFICE.contains(upper)) {
                return false;
            }
            if (DRIVER.equals(upper)) {
                hasDriver = true;
            }
        }
        return hasDriver;
    }

    /** The caller's own employee id, or null when unauthenticated. */
    public Long callerId(EmployeePrincipal principal) {
        return (principal == null || principal.getEmployee() == null)
                ? null
                : principal.getEmployee().getId();
    }

    /**
     * Guards endpoints that take an employee id in the URL. A driver may pass
     * only their own id; office staff may pass any.
     */
    public void requireCanReadTasksOf(EmployeePrincipal principal, Long employeeId) {
        if (principal == null) {
            throw new AccessDeniedException(DENIED);
        }
        if (!isDriverOnly(principal.getEmployee())) {
            return;
        }
        Long self = callerId(principal);
        if (self == null || !self.equals(employeeId)) {
            throw new AccessDeniedException(DENIED);
        }
    }

    /**
     * Guards a single task, by read or by write. A task reaches a driver only
     * through a route assigned to them; a task with no route (not yet planned)
     * is office-only by definition.
     */
    public void requireCanAccessTask(EmployeePrincipal principal, Task task) {
        if (principal == null) {
            throw new AccessDeniedException(DENIED);
        }
        if (!isDriverOnly(principal.getEmployee())) {
            return;
        }
        Long self = callerId(principal);
        if (self == null || task == null || task.getRoute() == null) {
            throw new AccessDeniedException(DENIED);
        }
        Employee assignee = task.getRoute().getEmployee();
        if (assignee == null || !self.equals(assignee.getId())) {
            throw new AccessDeniedException(DENIED);
        }
    }

    /**
     * Guards the unscoped overview endpoints (all tasks, tasks by route). A
     * driver has no legitimate use for either - the driver app fetches its work
     * through /api/tasks/mine.
     */
    public void requireOfficeRole(EmployeePrincipal principal) {
        if (principal == null || isDriverOnly(principal.getEmployee())) {
            throw new AccessDeniedException(DENIED);
        }
    }
}
