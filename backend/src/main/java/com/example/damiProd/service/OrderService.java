package com.example.damiProd.service;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Product;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;

    public OrderService(OrderRepository orderRepository, ClientRepository clientRepository,
            ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
    }

    public Order createOrder(Long clientId, Order order) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + clientId));

        order.setClient(client);

        // Link product if present (assuming frontend sends product object with ID)
        if (order.getProduct() != null && order.getProduct().getId() != null) {
            Product product = productRepository.findById(order.getProduct().getId())
                    .orElseThrow(
                            () -> new RuntimeException("Product not found with id: " + order.getProduct().getId()));
            order.setProduct(product);
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
        
        // Update basic fields
        if (orderDetails.getOrderType() != null) {
            existingOrder.setOrderType(orderDetails.getOrderType());
        }
        if (orderDetails.getQuantity() != null) {
            existingOrder.setQuantity(orderDetails.getQuantity());
        }
        if (orderDetails.getLocationAddress() != null) {
            existingOrder.setLocationAddress(orderDetails.getLocationAddress());
        }
        if (orderDetails.getLocationCoordinates() != null) {
            existingOrder.setLocationCoordinates(orderDetails.getLocationCoordinates());
        }
        if (orderDetails.getContact() != null) {
            existingOrder.setContact(orderDetails.getContact());
        }
        if (orderDetails.getDetails() != null) {
            existingOrder.setDetails(orderDetails.getDetails());
        }
        if (orderDetails.getStartDate() != null) {
            existingOrder.setStartDate(orderDetails.getStartDate());
        }
        if (orderDetails.getEndDate() != null) {
            existingOrder.setEndDate(orderDetails.getEndDate());
        }
        if (orderDetails.getIsIndefinite() != null) {
            existingOrder.setIsIndefinite(orderDetails.getIsIndefinite());
        }
        if (orderDetails.getDurationDays() != null) {
            existingOrder.setDurationDays(orderDetails.getDurationDays());
        }
        if (orderDetails.getIgienizariPerMonth() != null) {
            existingOrder.setIgienizariPerMonth(orderDetails.getIgienizariPerMonth());
        }
        // Update routeDefinition if provided
        if (orderDetails.getRouteDefinition() != null) {
            existingOrder.setRouteDefinition(orderDetails.getRouteDefinition());
        }
        // Update product if provided
        if (orderDetails.getProduct() != null && orderDetails.getProduct().getId() != null) {
            Product product = productRepository.findById(orderDetails.getProduct().getId())
                    .orElseThrow(() -> new RuntimeException("Product not found with id: " + orderDetails.getProduct().getId()));
            existingOrder.setProduct(product);
        }
        
        return orderRepository.save(existingOrder);
    }

    public List<Order> getOrdersByRoute(Long routeDefinitionId) {
        return orderRepository.findByRouteDefinitionId(routeDefinitionId);
    }
}
