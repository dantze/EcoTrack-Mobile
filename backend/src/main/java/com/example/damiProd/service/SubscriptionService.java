package com.example.damiProd.service;

import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.dto.SubscriptionUsageResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final OrderRepository orderRepository;
    private final RecurringIgienizareRepository recurringRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               OrderRepository orderRepository,
                               RecurringIgienizareRepository recurringRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.orderRepository = orderRepository;
        this.recurringRepository = recurringRepository;
    }

    /** Returns only active plans — used for frontend dropdowns */
    public List<Subscription> getActiveSubscriptions() {
        return subscriptionRepository.findByIsActiveTrue();
    }

    /** Returns all plans including retired ones — used for admin views */
    public List<Subscription> getAllSubscriptions() {
        return subscriptionRepository.findAll();
    }

    public Subscription getById(Long id) {
        return subscriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + id));
    }

    public Subscription save(Subscription subscription) {
        return subscriptionRepository.save(subscription);
    }

    public Subscription update(Long id, Subscription updated) {
        Subscription existing = getById(id);
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setType(updated.getType());
        existing.setPrice(updated.getPrice());
        existing.setVisitsPerMonth(updated.getVisitsPerMonth());
        existing.setDurationMonths(updated.getDurationMonths());
        existing.setIsIndefinite(updated.getIsIndefinite());
        existing.setIsActive(updated.getIsActive());
        return subscriptionRepository.save(existing);
    }

    /**
     * What is still holding this plan open. Advisory: the UI calls it to explain
     * a refusal before the operator commits, but deactivate() re-checks.
     */
    public SubscriptionUsageResponse usage(Long id) {
        getById(id); // 404 for an unknown plan, rather than a misleading empty answer
        return SubscriptionUsageResponse.of(
                orderRepository.findLiveBySubscriptionId(id),
                recurringRepository.findBySubscription_IdAndActiveTrue(id));
    }

    /**
     * Retires the plan — refused while anything live still points at it.
     *
     * The delete is a SOFT one (isActive = false), so orders already FINISHED on
     * this plan keep resolving through the surviving row and do not block. What
     * blocks is work that has not happened yet:
     *
     *   - Igienizare orders with no COMPLETED task, and
     *   - ACTIVE recurring plans, which would otherwise keep generating brand
     *     new orders against a retired plan every night.
     *
     * Deliberately NOT a bulk "move these to another plan" — that would be a
     * write the operator did not ask for. Refuse, name the blockers, and let
     * them be fulfilled, deleted or re-pointed one at a time.
     */
    public void deactivate(Long id) {
        Subscription sub = getById(id);

        List<IgienizareOrder> liveOrders = orderRepository.findLiveBySubscriptionId(id);
        List<RecurringIgienizare> activePlans = recurringRepository.findBySubscription_IdAndActiveTrue(id);

        if (!liveOrders.isEmpty() || !activePlans.isEmpty()) {
            throw new IllegalStateException(blockedMessage(liveOrders.size(), activePlans.size()));
        }

        sub.setIsActive(false);
        subscriptionRepository.save(sub);
    }

    /**
     * Romanian, and counted properly: "1 comandă" but "2 comenzi", and "de"
     * before the noun once the last two digits reach 20 ("24 de comenzi").
     */
    public static String blockedMessage(int orderCount, int planCount) {
        StringBuilder reason = new StringBuilder("Nu se poate șterge abonamentul: ");
        if (orderCount > 0) {
            reason.append(count(orderCount, "comandă nefinalizată", "comenzi nefinalizate"));
        }
        if (orderCount > 0 && planCount > 0) {
            reason.append(" și ");
        }
        if (planCount > 0) {
            reason.append(count(planCount, "plan recurent activ", "planuri recurente active"));
        }
        reason.append(orderCount + planCount == 1 ? " îl folosește încă." : " îl folosesc încă.");
        reason.append(" Finalizează sau șterge-le, ori mută-le pe alt abonament.");
        return reason.toString();
    }

    private static String count(int value, String singular, String plural) {
        if (value == 1) return "1 " + singular;
        int lastTwo = value % 100;
        boolean needsDe = lastTwo == 0 || lastTwo >= 20;
        return value + " " + (needsDe ? "de " : "") + plural;
    }
}
