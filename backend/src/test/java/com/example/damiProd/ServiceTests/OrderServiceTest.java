package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.*;
import com.example.damiProd.repository.*;
import com.example.damiProd.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private ProductRepository productRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private TaskRepository taskRepository;

    @InjectMocks
    private OrderService orderService;

    private Company mockClient;
    private Product mockProduct;
    private Subscription mockSubscription;

    @BeforeEach
    void setUp() {
        mockClient = new Company("firma@test.ro", "0722111111", "Str. Firmei 1", "Acme SRL", "RO99999999", "Admin Ion");
        mockClient.setId(1L);

        mockProduct = new Product("Toaletă Standard", "Standard cabin", 500.0);
        mockProduct.setId(10L);

        mockSubscription = new Subscription();
        mockSubscription.setId(20L);
        mockSubscription.setName("Plan Lunar");
        mockSubscription.setType(SubscriptionType.RECURRING);
        mockSubscription.setPrice(200.0);
    }

    // -----------------------------------------------------------------------
    // TEST 1 — createOrder links client & product for AmplasareOrder
    // -----------------------------------------------------------------------
    @Test
    void createOrder_amplasare_shouldLinkClientAndProduct() {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setQuantity(3);
        order.setLocationAddress("Str. Test 5");

        Product productRef = new Product();
        productRef.setId(10L);
        order.setProduct(productRef);

        when(clientRepository.findById(1L)).thenReturn(Optional.of(mockClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(mockProduct));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order saved = inv.getArgument(0);
            saved.setId(100L);
            return saved;
        });

        Order result = orderService.createOrder(1L, order);

        assertThat(result.getClient()).isEqualTo(mockClient);
        assertThat(((AmplasareOrder) result).getProduct()).isEqualTo(mockProduct);
        assertThat(result.getId()).isEqualTo(100L);
    }

    // -----------------------------------------------------------------------
    // TEST 2 — createOrder links subscription for IgienizareOrder
    // -----------------------------------------------------------------------
    @Test
    void createOrder_igienizare_shouldLinkSubscription() {
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setSanitationLocationAddress("Str. Igienă 10");

        Subscription subRef = new Subscription();
        subRef.setId(20L);
        order.setSubscription(subRef);

        when(clientRepository.findById(1L)).thenReturn(Optional.of(mockClient));
        when(subscriptionRepository.findById(20L)).thenReturn(Optional.of(mockSubscription));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        Order result = orderService.createOrder(1L, order);

        assertThat(((IgienizareOrder) result).getSubscription()).isEqualTo(mockSubscription);
        assertThat(((IgienizareOrder) result).getSubscription().getName()).isEqualTo("Plan Lunar");
    }

    // -----------------------------------------------------------------------
    // TEST 3 — createOrder throws when client not found
    // -----------------------------------------------------------------------
    @Test
    void createOrder_shouldThrowWhenClientNotFound() {
        when(clientRepository.findById(999L)).thenReturn(Optional.empty());

        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");

        assertThatThrownBy(() -> orderService.createOrder(999L, order))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Client not found");
    }

    // -----------------------------------------------------------------------
    // TEST 4 — getOrdersByClient returns list
    // -----------------------------------------------------------------------
    @Test
    void getOrdersByClient_shouldReturnList() {
        AmplasareOrder order = new AmplasareOrder();
        order.setId(100L);
        order.setClient(mockClient);

        when(orderRepository.findByClientId(1L)).thenReturn(List.of(order));

        List<Order> result = orderService.getOrdersByClient(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(100L);
    }

    // -----------------------------------------------------------------------
    // TEST 5 — deleteOrder cascades task deletion
    // -----------------------------------------------------------------------
    @Test
    void deleteOrder_shouldDeleteTaskFirst() {
        Task mockTask = new Task();
        mockTask.setId(50L);
        when(taskRepository.findByOrder_Id(100L)).thenReturn(Optional.of(mockTask));

        orderService.deleteOrder(100L);

        verify(taskRepository).delete(mockTask);
        verify(orderRepository).deleteById(100L);
    }

    // -----------------------------------------------------------------------
    // TEST 6 — deleteOrder with no task still deletes order
    // -----------------------------------------------------------------------
    @Test
    void deleteOrder_noTask_shouldDeleteOrderOnly() {
        when(taskRepository.findByOrder_Id(100L)).thenReturn(Optional.empty());

        orderService.deleteOrder(100L);

        verify(taskRepository, never()).delete(any());
        verify(orderRepository).deleteById(100L);
    }

    // -----------------------------------------------------------------------
    // TEST 7 — getOrderById returns order
    // -----------------------------------------------------------------------
    @Test
    void getOrderById_shouldReturnOrder() {
        AmplasareOrder order = new AmplasareOrder();
        order.setId(100L);
        order.setOrderType("Amplasari");

        when(orderRepository.findByIdWithClientAndProduct(100L)).thenReturn(Optional.of(order));

        Order result = orderService.getOrderById(100L);
        assertThat(result.getId()).isEqualTo(100L);
    }

    // -----------------------------------------------------------------------
    // TEST 8 — getOrderById throws when not found
    // -----------------------------------------------------------------------
    @Test
    void getOrderById_shouldThrowWhenNotFound() {
        when(orderRepository.findByIdWithClientAndProduct(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getOrderById(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Order not found");
    }

    // -----------------------------------------------------------------------
    // TEST 9 — updateOrder updates shared and Amplasare-specific fields
    // -----------------------------------------------------------------------
    @Test
    void updateOrder_shouldUpdateAmplasareFields() {
        AmplasareOrder existing = new AmplasareOrder();
        existing.setId(100L);
        existing.setOrderType("Amplasari");
        existing.setQuantity(2);
        existing.setLocationAddress("Old Address");
        existing.setContact("Old Contact");

        AmplasareOrder updates = new AmplasareOrder();
        updates.setQuantity(5);
        updates.setLocationAddress("New Address");
        updates.setContact("New Contact");

        when(orderRepository.findById(100L)).thenReturn(Optional.of(existing));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        Order result = orderService.updateOrder(100L, updates);

        assertThat(result.getContact()).isEqualTo("New Contact");
        assertThat(((AmplasareOrder) result).getQuantity()).isEqualTo(5);
        assertThat(((AmplasareOrder) result).getLocationAddress()).isEqualTo("New Address");
    }

    // -----------------------------------------------------------------------
    // TEST 10 — createOrder for RidicareOrder links product
    // -----------------------------------------------------------------------
    @Test
    void createOrder_ridicare_shouldLinkProduct() {
        RidicareOrder order = new RidicareOrder();
        order.setOrderType("Ridicari");
        order.setPickupLocationAddress("Str. Ridicare 5");

        Product productRef = new Product();
        productRef.setId(10L);
        order.setProduct(productRef);

        when(clientRepository.findById(1L)).thenReturn(Optional.of(mockClient));
        when(productRepository.findById(10L)).thenReturn(Optional.of(mockProduct));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        Order result = orderService.createOrder(1L, order);

        assertThat(result.getClient()).isEqualTo(mockClient);
        assertThat(((RidicareOrder) result).getProduct()).isEqualTo(mockProduct);
    }
}
