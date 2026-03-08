package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.dto.CreateRouteRequest;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class RouteService {

    private final RouteRepository routeRepository;
    private final EmployeeRepository employeeRepository;
    private final TaskRepository taskRepository;

    public RouteService(RouteRepository routeRepository, EmployeeRepository employeeRepository, TaskRepository taskRepository) {
        this.routeRepository = routeRepository;
        this.employeeRepository = employeeRepository;
        this.taskRepository = taskRepository;
    }

    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @Transactional
    public Route createRoute(CreateRouteRequest request) {
        Route route = new Route();
        route.setName(request.getName());
        route.setDate(request.getDate());
        route.setDayOfWeek(request.getDayOfWeek());
        route.setCounty(request.getCounty());

        // Set employee if provided
        if (request.getEmployeeId() != null) {
            Employee employee = employeeRepository.findById(request.getEmployeeId())
                    .orElseThrow(() -> new RuntimeException("Angajatul nu a fost găsit"));
            route.setEmployee(employee);
        }

        return routeRepository.save(route);
    }

    public void deleteRoute(Long id) {
        routeRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Route getRouteById(Long id) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));
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
    public List<Route> getRoutesByEmployeeIdAndDate(Long employeeId, LocalDate date) {
        List<Route> routes = routeRepository.findByEmployee_IdAndDate(employeeId, date);
        // Force loading of tasks for each route
        routes.forEach(route -> route.getTasks().size());
        return routes;
    }

    @Transactional
    public Route assignDriverToRoute(Long routeId, Long employeeId) {
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Angajatul nu a fost găsit"));

        route.setEmployee(employee);
        return routeRepository.save(route);
    }

    @Transactional
    public Route reorderTasks(Long routeId, List<Long> taskIds) {
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new RuntimeException("Ruta nu a fost găsită"));

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
        Route reloaded = routeRepository.findById(routeId).orElseThrow();
        reloaded.getTasks().size(); // force load
        return reloaded;
    }
}