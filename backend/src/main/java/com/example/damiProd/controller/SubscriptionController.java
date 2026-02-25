package com.example.damiProd.controller;

import com.example.damiProd.domain.Subscription;
import com.example.damiProd.service.SubscriptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    /** Frontend dropdown — only active plans */
    @GetMapping
    public ResponseEntity<List<Subscription>> getActiveSubscriptions() {
        return ResponseEntity.ok(subscriptionService.getActiveSubscriptions());
    }

    /** Admin view — all plans including retired */
    @GetMapping("/all")
    public ResponseEntity<List<Subscription>> getAllSubscriptions() {
        return ResponseEntity.ok(subscriptionService.getAllSubscriptions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Subscription> getById(@PathVariable Long id) {
        return ResponseEntity.ok(subscriptionService.getById(id));
    }

    @PostMapping
    public ResponseEntity<Subscription> create(@RequestBody Subscription subscription) {
        return ResponseEntity.ok(subscriptionService.save(subscription));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Subscription> update(@PathVariable Long id, @RequestBody Subscription subscription) {
        return ResponseEntity.ok(subscriptionService.update(id, subscription));
    }

    /** Soft-delete: marks the plan as inactive, does not remove it */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        subscriptionService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
