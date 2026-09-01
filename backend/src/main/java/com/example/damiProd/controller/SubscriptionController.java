package com.example.damiProd.controller;

import com.example.damiProd.domain.Subscription;
import com.example.damiProd.dto.MoveOrdersRequest;
import com.example.damiProd.dto.SubscriptionUsageResponse;
import com.example.damiProd.service.SubscriptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    /**
     * What still holds this plan open, so the UI can explain a refusal before
     * the operator commits to one. Advisory only — DELETE re-checks.
     */
    @GetMapping("/{id}/usage")
    public ResponseEntity<SubscriptionUsageResponse> usage(@PathVariable Long id) {
        return ResponseEntity.ok(subscriptionService.usage(id));
    }

    /**
     * Moves live orders off this plan and onto another (TODO-37).
     *
     * The way out of the 409 that DELETE answers with: the refusal names the
     * blocking orders, and this reassigns the ones the operator picked so the
     * retry can succeed. 409 with a Romanian message when the plan is gone, the
     * target is retired, or the id list has gone stale — never a partial move.
     *
     * Does NOT touch active recurring plans, which block a delete for a
     * different reason and are stopped from Igienizări recurente. A plan with
     * live recurring work will still refuse to retire after this succeeds, and
     * the dialog says so.
     */
    @PostMapping("/{id}/orders/move")
    public ResponseEntity<Map<String, Object>> moveOrders(@PathVariable Long id,
                                                          @RequestBody MoveOrdersRequest request) {
        int moved = subscriptionService.moveOrders(
                id, request.getTargetSubscriptionId(), request.getOrderIds());
        return ResponseEntity.ok(Map.of("moved", moved));
    }

    /**
     * Soft-delete: marks the plan as inactive, does not remove it.
     *
     * Answers 409 while unfinished orders or active recurring plans still use
     * it — see SubscriptionService.deactivate().
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        subscriptionService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
