package com.example.damiProd.ServiceTests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.Date;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.Route;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.service.TaskService;

@ExtendWith(MockitoExtension.class)
public class TaskServiceTest {

    @Mock private TaskRepository taskRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private RouteRepository routeRepository;

    @InjectMocks
    private TaskService taskService;

    // Shared test data — built once before each test
    private Company mockCompany;
    private AmplasareOrder mockOrder;
    private Employee mockDriver;
    private Route mockRoute;

    @BeforeEach
    void setUp() {
        // Client
        mockCompany = new Company(
            "contact@techcorp.ro", "0722123456",
            "123 Innovation Street, Bucharest",
            "TechCorp Solutions SRL", "RO12345678", "Andrei Ionescu"
        );
        mockCompany.setId(5L);

        // Route assigned to a driver
        mockDriver = new Employee("driver1", "password", "Ion Șofer", "0711000000");
        mockDriver.setId(99L);

        mockRoute = new Route();
        mockRoute.setId(20L);
        mockRoute.setName("Ruta Cluj Nord");
        mockRoute.setEmployee(mockDriver);
    }

    @Test
    public void testTaskAndOrderAssignment() {
        // Order belonging to the client, not yet on any route
        mockOrder = new AmplasareOrder();
        mockOrder.setId(10L);
        mockOrder.setNumber(1001);
        mockOrder.setDate(new Date());
        mockOrder.setClient(mockCompany);
        mockOrder.setOrderType("Amplasari");
        mockOrder.setQuantity(2);
        mockOrder.setLocationAddress("Str. Exemplu 5, Cluj");
        mockOrder.setStartDate("2026-03-01");
        mockOrder.setEndDate("2026-06-01");

        // Tell mocks what to return when the service calls them
        when(taskRepository.existsByOrder_Id(10L)).thenReturn(false);       // no duplicate task
        when(orderRepository.findById(10L)).thenReturn(Optional.of(mockOrder));
        when(routeRepository.findById(20L)).thenReturn(Optional.of(mockRoute));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        // ACT — assign the order to the driver's route
        Task task = taskService.createTaskFromOrder(10L, 20L);

        // ASSERT — task is linked to the correct order and its client
        assertThat(task.getOrder()).isEqualTo(mockOrder);
        assertThat(task.getOrder().getClient()).isEqualTo(mockCompany);

        // ASSERT — task is assigned to the driver's route
        assertThat(task.getRoute()).isEqualTo(mockRoute);
        assertThat(task.getRoute().getEmployee()).isEqualTo(mockDriver);
        assertThat(task.getRoute().getEmployee().getId()).isEqualTo(99L);

        // ASSERT — client name is taken from the company on the order
        assertThat(task.getClientName()).isEqualTo("TechCorp Solutions SRL");

        // ASSERT — every new task starts with status NEW
        assertThat(task.getStatus()).isEqualTo(TaskStatus.NEW);
    }
}
