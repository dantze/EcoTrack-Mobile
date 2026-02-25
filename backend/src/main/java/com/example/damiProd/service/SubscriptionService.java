package com.example.damiProd.service;

import com.example.damiProd.domain.Subscription;
import com.example.damiProd.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
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
                .orElseThrow(() -> new RuntimeException("Subscription not found with id: " + id));
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

    public void deactivate(Long id) {
        Subscription sub = getById(id);
        sub.setIsActive(false);
        subscriptionRepository.save(sub);
    }
}
