package com.example.damiProd.service;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;
    private final SubscriptionRepository subscriptionRepository;

    public OrderService(OrderRepository orderRepository, ClientRepository clientRepository,
            ProductRepository productRepository, SubscriptionRepository subscriptionRepository) {
        this.orderRepository = orderRepository;
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    public Order createOrder(Long clientId, Order order) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + clientId));
        order.setClient(client);

        // ─── Link product for Amplasare & Ridicare ───
        if (order instanceof AmplasareOrder amp && amp.getProduct() != null && amp.getProduct().getId() != null) {
            Product product = productRepository.findById(amp.getProduct().getId())
                    .orElseThrow(() -> new RuntimeException("Product not found with id: " + amp.getProduct().getId()));
            amp.setProduct(product);
        }
        if (order instanceof RidicareOrder rid && rid.getProduct() != null && rid.getProduct().getId() != null) {
            Product product = productRepository.findById(rid.getProduct().getId())
                    .orElseThrow(() -> new RuntimeException("Product not found with id: " + rid.getProduct().getId()));
            rid.setProduct(product);
        }

        // ─── Link subscription for Igienizare ───
        if (order instanceof IgienizareOrder igi && igi.getSubscription() != null
                && igi.getSubscription().getId() != null) {
            Subscription sub = subscriptionRepository.findById(igi.getSubscription().getId())
                    .orElseThrow(() -> new RuntimeException(
                            "Subscription not found with id: " + igi.getSubscription().getId()));
            igi.setSubscription(sub);
        }

        return orderRepository.save(order);
    }

    public List<Order> getOrdersByClient(Long clientId) {
        return orderRepository.findByClientId(clientId);
    }

    public void deleteOrder(Long orderId) {
        orderRepository.deleteById(orderId);
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAllWithClientAndProduct();
    }

    public Order getOrderById(Long orderId) {
        return orderRepository.findByIdWithClientAndProduct(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found with id: " + orderId));
    }

    public Order updateOrder(Long orderId, Order orderDetails) {
        Order existingOrder = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found with id: " + orderId));

        // ─── Shared fields ───
        if (orderDetails.getContact() != null)
            existingOrder.setContact(orderDetails.getContact());
        if (orderDetails.getDetails() != null)
            existingOrder.setDetails(orderDetails.getDetails());
        if (orderDetails.getRouteDefinition() != null)
            existingOrder.setRouteDefinition(orderDetails.getRouteDefinition());

        // ─── Amplasare-specific fields ───
        if (existingOrder instanceof AmplasareOrder existing && orderDetails instanceof AmplasareOrder updates) {
            if (updates.getProduct() != null && updates.getProduct().getId() != null) {
                Product product = productRepository.findById(updates.getProduct().getId())
                        .orElseThrow(() -> new RuntimeException(
                                "Product not found with id: " + updates.getProduct().getId()));
                existing.setProduct(product);
            }
            if (updates.getQuantity() != null)
                existing.setQuantity(updates.getQuantity());
            if (updates.getIsIndefinite() != null)
                existing.setIsIndefinite(updates.getIsIndefinite());
            if (updates.getDurationDays() != null)
                existing.setDurationDays(updates.getDurationDays());
            if (updates.getStartDate() != null)
                existing.setStartDate(updates.getStartDate());
            if (updates.getEndDate() != null)
                existing.setEndDate(updates.getEndDate());
            if (updates.getLocationCoordinates() != null)
                existing.setLocationCoordinates(updates.getLocationCoordinates());
            if (updates.getLocationAddress() != null)
                existing.setLocationAddress(updates.getLocationAddress());
            if (updates.getIgienizariPerMonth() != null)
                existing.setIgienizariPerMonth(updates.getIgienizariPerMonth());
        }

        // ─── Ridicare-specific fields ───
        if (existingOrder instanceof RidicareOrder existing && orderDetails instanceof RidicareOrder updates) {
            if (updates.getProduct() != null && updates.getProduct().getId() != null) {
                Product product = productRepository.findById(updates.getProduct().getId())
                        .orElseThrow(() -> new RuntimeException(
                                "Product not found with id: " + updates.getProduct().getId()));
                existing.setProduct(product);
            }
            if (updates.getPickupDate() != null)
                existing.setPickupDate(updates.getPickupDate());
            if (updates.getPickupQuantity() != null)
                existing.setPickupQuantity(updates.getPickupQuantity());
            if (updates.getPickupProductName() != null)
                existing.setPickupProductName(updates.getPickupProductName());
            if (updates.getPickupLocationAddress() != null)
                existing.setPickupLocationAddress(updates.getPickupLocationAddress());
            if (updates.getPickupLocationCoordinates() != null)
                existing.setPickupLocationCoordinates(updates.getPickupLocationCoordinates());
        }

        // ─── Igienizare-specific fields ───
        if (existingOrder instanceof IgienizareOrder existing && orderDetails instanceof IgienizareOrder updates) {
            if (updates.getSubscription() != null && updates.getSubscription().getId() != null) {
                Subscription sub = subscriptionRepository.findById(updates.getSubscription().getId())
                        .orElseThrow(() -> new RuntimeException(
                                "Subscription not found with id: " + updates.getSubscription().getId()));
                existing.setSubscription(sub);
            }
            if (updates.getSanitationDate() != null)
                existing.setSanitationDate(updates.getSanitationDate());
            if (updates.getSanitationLocationAddress() != null)
                existing.setSanitationLocationAddress(updates.getSanitationLocationAddress());
            if (updates.getSanitationLocationCoordinates() != null)
                existing.setSanitationLocationCoordinates(updates.getSanitationLocationCoordinates());
        }

        return orderRepository.save(existingOrder);
    }

    public List<Order> getOrdersByRoute(Long routeDefinitionId) {
        return orderRepository.findByRouteDefinitionId(routeDefinitionId);
    }
}
