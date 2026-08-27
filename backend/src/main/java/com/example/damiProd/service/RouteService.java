package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.dto.CreateRouteRequest;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RouteService {

    private final RouteRepository routeRepository;
    private final EmployeeRepository employeeRepository;
    private final TaskRepository taskRepository;
    private final RecurringIgienizareRepository recurringIgienizareRepository;

    public RouteService(RouteRepository routeRepository, EmployeeRepository employeeRepository,
                        TaskRepository taskRepository, RecurringIgienizareRepository recurringIgienizareRepository) {
        this.routeRepository = routeRepository;
        this.employeeRepository = employeeRepository;
        this.taskRepository = taskRepository;
        this.recurringIgienizareRepository = recurringIgienizareRepository;
    }

    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @Transactional
    public Route createRoute(CreateRouteRequest request) {
        Route route = new Route();
        route.setName(request.getName());
        route.setDayOfWeek(request.getDayOfWeek());
        route.setCounty(request.getCounty());

        // Set employee if provided
        if (request.getEmployeeId() != null) {
            route.setEmployee(requireEmployee(request.getEmployeeId()));
        }

        return routeRepository.save(route);
    }

    @Transactional
    public void deleteRoute(Long id) {
        Route route = requireRoute(id);

        // Unassign all tasks from this route (set route = null so they become "neatribuite")
        List<Task> tasks = taskRepository.findByRoute_Id(id);
        for (Task task : tasks) {
            task.setRoute(null);
        }
        taskRepository.saveAll(tasks);

        // Unassign all recurring igienizare plans from this route
        List<RecurringIgienizare> plans = recurringIgienizareRepository.findByRoute_Id(id);
        for (RecurringIgienizare plan : plans) {
            plan.setRoute(null);
        }
        recurringIgienizareRepository.saveAll(plans);

        // Now delete the route (no orphan tasks will be cascade-deleted)
        routeRepository.delete(route);
    }

    @Transactional(readOnly = true)
    public Route getRouteById(Long id) {
        Route route = requireRoute(id);
        // Force loading of tasks (triggers lazy loading within transaction)
        route.getTasks().size();
        return route;
    }

    @Transactional(readOnly = true)
    public List<Route> getRoutesByEmployeeId(Long employeeId) {
        List<Route> routes = routeRepository.findByEmployee_Id(employeeId);
        // Force loading of tasks for each route
        routes.forEach(route -> route.getTasks().size());
        return routes;
    }

    @Transactional(readOnly = true)
    public List<Route> getRoutesByEmployeeIdAndDayOfWeek(Long employeeId, Integer dayOfWeek) {
        List<Route> routes = routeRepository.findByEmployee_IdAndDayOfWeek(employeeId, dayOfWeek);
        // Force loading of tasks for each route
        routes.forEach(route -> route.getTasks().size());
        return routes;
    }

    @Transactional
    public Route assignDriverToRoute(Long routeId, Long employeeId) {
        Route route = requireRoute(routeId);
        Employee employee = requireEmployee(employeeId);

        route.setEmployee(employee);
        return routeRepository.save(route);
    }

    @Transactional
    public Route reorderTasks(Long routeId, List<Long> taskIds) {
        // Existence check only; the route itself is re-read below, after the
        // new indexes have been written.
        requireRoute(routeId);

        List<Task> tasks = taskRepository.findByRoute_Id(routeId);

        for (int i = 0; i < taskIds.size(); i++) {
            final Long taskId = taskIds.get(i);
            final int newIndex = i;
            tasks.stream()
                    .filter(t -> t.getId().equals(taskId))
                    .findFirst()
                    .ifPresent(t -> t.setOrderIndex(newIndex));
        }

        taskRepository.saveAll(tasks);

        // Reload route with ordered tasks
        Route reloaded = requireRoute(routeId);
        reloaded.getTasks().size(); // force load
        return reloaded;
    }

    private Route requireRoute(Long id) {
        return routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta nu a fost găsită"));
    }

    private Employee requireEmployee(Long id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Angajatul nu a fost găsit"));
    }
}