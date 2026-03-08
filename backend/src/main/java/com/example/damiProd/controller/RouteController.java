package com.example.damiProd.controller;

import com.example.damiProd.domain.Route;
import com.example.damiProd.dto.CreateRouteRequest;
import com.example.damiProd.service.RouteService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService routeService;

    public RouteController(RouteService routeService) {
        this.routeService = routeService;
    }

    @GetMapping
    public ResponseEntity<List<Route>> getAllRoutes() {
        return ResponseEntity.ok(routeService.getAllRoutes());
    }

    @PostMapping
    public ResponseEntity<Route> createRoute(@RequestBody CreateRouteRequest request) {
        Route savedRoute = routeService.createRoute(request);
        return ResponseEntity.ok(savedRoute);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoute(@PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }

    // Get a specific route by ID (with tasks)
    @GetMapping("/{id}")
    public ResponseEntity<Route> getRouteById(@PathVariable Long id) {
        Route route = routeService.getRouteById(id);
        return ResponseEntity.ok(route);
    }

    // Get all routes for a specific employee (driver)
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<Route>> getRoutesByEmployee(@PathVariable Long employeeId) {
        List<Route> routes = routeService.getRoutesByEmployeeId(employeeId);
        return ResponseEntity.ok(routes);
    }

    // Get routes for a specific employee on a specific date
    @GetMapping("/employee/{employeeId}/date/{date}")
    public ResponseEntity<List<Route>> getRoutesByEmployeeAndDate(
            @PathVariable Long employeeId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<Route> routes = routeService.getRoutesByEmployeeIdAndDate(employeeId, date);
        return ResponseEntity.ok(routes);
    }

    // Assign a driver to a route
    @PutMapping("/{routeId}/assign-driver/{employeeId}")
    public ResponseEntity<Route> assignDriverToRoute(
            @PathVariable Long routeId,
            @PathVariable Long employeeId) {
        Route updatedRoute = routeService.assignDriverToRoute(routeId, employeeId);
        return ResponseEntity.ok(updatedRoute);
    }

    // Reorder tasks within a route
    @PutMapping("/{routeId}/reorder-tasks")
    public ResponseEntity<Route> reorderTasks(
            @PathVariable Long routeId,
            @RequestBody List<Long> taskIds) {
        Route updatedRoute = routeService.reorderTasks(routeId, taskIds);
        return ResponseEntity.ok(updatedRoute);
    }
}