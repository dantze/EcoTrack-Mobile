package com.example.damiProd.controller;

import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.service.RecurringIgienizareService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recurring-igienizari")
public class RecurringIgienizareController {

    private final RecurringIgienizareService service;

    public RecurringIgienizareController(RecurringIgienizareService service) {
        this.service = service;
    }

    @GetMapping
    public List<RecurringIgienizare> getAll() {
        return service.getAll();
    }

    @GetMapping("/active")
    public List<RecurringIgienizare> getActive() {
        return service.getActiveOnly();
    }

    @GetMapping("/unassigned")
    public List<RecurringIgienizare> getUnassigned() {
        return service.getUnassigned();
    }

    @GetMapping("/{id}")
    public RecurringIgienizare getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping("/client/{clientId}")
    public List<RecurringIgienizare> getByClient(@PathVariable Long clientId) {
        return service.getByClient(clientId);
    }

    @PostMapping("/client/{clientId}")
    public RecurringIgienizare create(@PathVariable Long clientId,
                                      @RequestBody RecurringIgienizare plan) {
        return service.create(clientId, plan);
    }

    @PutMapping("/{id}/assign-route")
    public RecurringIgienizare assignRoute(@PathVariable Long id,
                                           @RequestBody Map<String, Long> body) {
        Long routeId = body.get("routeId");
        if (routeId == null) throw new RuntimeException("routeId is required");
        return service.assignRoute(id, routeId);
    }

    @PutMapping("/{id}/deactivate")
    public RecurringIgienizare deactivate(@PathVariable Long id) {
        return service.deactivate(id);
    }
}
