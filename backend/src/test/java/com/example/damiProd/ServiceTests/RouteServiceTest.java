package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.Route;
import com.example.damiProd.dto.CreateRouteRequest;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.RouteRepository;
import com.example.damiProd.service.RouteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RouteServiceTest {

    @Mock private RouteRepository routeRepository;
    @Mock private EmployeeRepository employeeRepository;

    @InjectMocks
    private RouteService routeService;

    private Employee mockDriver;

    @BeforeEach
    void setUp() {
        mockDriver = new Employee("driver1", "Ion Șofer", "0711000000");
        mockDriver.setId(5L);
        mockDriver.setCounty("Cluj");
    }

    // -----------------------------------------------------------------------
    // TEST 1 — createRoute with employee links employee
    // -----------------------------------------------------------------------
    @Test
    void createRoute_withEmployee_shouldLinkEmployee() {
        CreateRouteRequest request = new CreateRouteRequest();
        request.setName("Ruta Cluj Nord");
        request.setDayOfWeek(2);
        request.setDayOfWeek(2);
        request.setCounty("Cluj");
        request.setEmployeeId(5L);

        when(employeeRepository.findById(5L)).thenReturn(Optional.of(mockDriver));
        when(routeRepository.save(any(Route.class))).thenAnswer(inv -> {
            Route saved = inv.getArgument(0);
            saved.setId(10L);
            return saved;
        });

        Route result = routeService.createRoute(request);

        assertThat(result.getName()).isEqualTo("Ruta Cluj Nord");
        assertThat(result.getEmployee()).isEqualTo(mockDriver);
        assertThat(result.getDayOfWeek()).isEqualTo(2);
        assertThat(result.getCounty()).isEqualTo("Cluj");
    }

    // -----------------------------------------------------------------------
    // TEST 2 — createRoute without employee sets no employee
    // -----------------------------------------------------------------------
    @Test
    void createRoute_withoutEmployee_shouldNotSetEmployee() {
        CreateRouteRequest request = new CreateRouteRequest();
        request.setName("Ruta Fără Șofer");
        request.setDayOfWeek(2);
        request.setCounty("Timiș");
        // employeeId is null

        when(routeRepository.save(any(Route.class))).thenAnswer(inv -> {
            Route saved = inv.getArgument(0);
            saved.setId(11L);
            return saved;
        });

        Route result = routeService.createRoute(request);

        assertThat(result.getName()).isEqualTo("Ruta Fără Șofer");
        assertThat(result.getEmployee()).isNull();
    }

    // -----------------------------------------------------------------------
    // TEST 3 — createRoute throws when employee not found
    // -----------------------------------------------------------------------
    @Test
    void createRoute_shouldThrowWhenEmployeeNotFound() {
        CreateRouteRequest request = new CreateRouteRequest();
        request.setName("Ruta X");
        request.setDayOfWeek(2);
        request.setEmployeeId(999L);

        when(employeeRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.createRoute(request))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // TEST 4 — assignDriverToRoute updates the employee
    // -----------------------------------------------------------------------
    @Test
    void assignDriverToRoute_shouldUpdateEmployee() {
        Route route = new Route("Ruta Cluj", 2, "Cluj", null);
        route.setId(10L);

        when(routeRepository.findById(10L)).thenReturn(Optional.of(route));
        when(employeeRepository.findById(5L)).thenReturn(Optional.of(mockDriver));
        when(routeRepository.save(any(Route.class))).thenAnswer(inv -> inv.getArgument(0));

        Route result = routeService.assignDriverToRoute(10L, 5L);

        assertThat(result.getEmployee()).isEqualTo(mockDriver);
        assertThat(result.getEmployee().getFullName()).isEqualTo("Ion Șofer");
    }

    // -----------------------------------------------------------------------
    // TEST 5 — assignDriverToRoute throws when route not found
    // -----------------------------------------------------------------------
    @Test
    void assignDriverToRoute_shouldThrowWhenRouteNotFound() {
        when(routeRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.assignDriverToRoute(999L, 5L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // TEST 6 — getRoutesByEmployeeId returns routes
    // -----------------------------------------------------------------------
    @Test
    void getRoutesByEmployeeId_shouldReturnRoutes() {
        Route route = new Route("Ruta Cluj", 2, "Cluj", mockDriver);
        route.setId(10L);

        when(routeRepository.findByEmployee_Id(5L)).thenReturn(List.of(route));

        List<Route> result = routeService.getRoutesByEmployeeId(5L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Ruta Cluj");
    }

    // -----------------------------------------------------------------------
    // TEST 7 — getRoutesByEmployeeIdAndDayOfWeek filters correctly
    // -----------------------------------------------------------------------
    @Test
    void getRoutesByEmployeeIdAndDayOfWeek_shouldFilterByWeekday() {
        // Routes are weekly, not dated: "Tuesday" is the whole schedule, and
        // there is no per-date copy to pick between.
        Route route = new Route("Ruta Cluj", 2, "Cluj", mockDriver);
        route.setId(10L);

        when(routeRepository.findByEmployee_IdAndDayOfWeek(5L, 2)).thenReturn(List.of(route));

        List<Route> result = routeService.getRoutesByEmployeeIdAndDayOfWeek(5L, 2);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDayOfWeek()).isEqualTo(2);
    }

    // -----------------------------------------------------------------------
    // TEST 8 — getAllRoutes returns all
    // -----------------------------------------------------------------------
    @Test
    void getAllRoutes_shouldReturnAll() {
        Route r1 = new Route("Ruta 1", 2, "Cluj", mockDriver);
        r1.setId(1L);
        Route r2 = new Route("Ruta 2", 3, "Timiș", null);
        r2.setId(2L);

        when(routeRepository.findAll()).thenReturn(List.of(r1, r2));

        List<Route> result = routeService.getAllRoutes();

        assertThat(result).hasSize(2);
    }
}
