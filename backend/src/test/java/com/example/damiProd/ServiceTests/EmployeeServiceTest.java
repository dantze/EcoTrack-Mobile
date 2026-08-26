package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.service.EmployeeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceTest {

    @Mock private EmployeeRepository employeeRepository;

    @InjectMocks
    private EmployeeService employeeService;

    private Employee driver;
    private Employee salesPerson;

    @BeforeEach
    void setUp() {
        EmployeeRole driverRole = new EmployeeRole("DRIVER");
        driverRole.setId(1L);

        EmployeeRole salesRole = new EmployeeRole("SALES");
        salesRole.setId(2L);

        driver = new Employee("sofer1", "pass", "Ion Șofer", "0711000000");
        driver.setId(1L);
        driver.setRoles(Set.of(driverRole));

        salesPerson = new Employee("vanzator1", "pass", "Maria Vânzări", "0722111222");
        salesPerson.setId(2L);
        salesPerson.setRoles(Set.of(salesRole));
    }

    // -----------------------------------------------------------------------
    // TEST 1 — getAllEmployees returns all
    // -----------------------------------------------------------------------
    @Test
    void getAllEmployees_shouldReturnAll() {
        when(employeeRepository.findAll()).thenReturn(List.of(driver, salesPerson));

        List<Employee> result = employeeService.getAllEmployees();

        assertThat(result).hasSize(2);
    }

    // -----------------------------------------------------------------------
    // TEST 2 — getEmployeeById found
    // -----------------------------------------------------------------------
    @Test
    void getEmployeeById_shouldReturnWhenFound() {
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(driver));

        Optional<Employee> result = employeeService.getEmployeeById(1L);

        assertThat(result).isPresent();
        assertThat(result.get().getFullName()).isEqualTo("Ion Șofer");
    }

    // -----------------------------------------------------------------------
    // TEST 3 — getEmployeeById not found
    // -----------------------------------------------------------------------
    @Test
    void getEmployeeById_shouldReturnEmptyWhenNotFound() {
        when(employeeRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<Employee> result = employeeService.getEmployeeById(999L);

        assertThat(result).isEmpty();
    }

    // -----------------------------------------------------------------------
    // TEST 4 — getAllDrivers filters only DRIVER role
    // -----------------------------------------------------------------------
    @Test
    void getAllDrivers_shouldReturnOnlyDrivers() {
        when(employeeRepository.findAll()).thenReturn(List.of(driver, salesPerson));

        List<Employee> result = employeeService.getAllDrivers();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getFullName()).isEqualTo("Ion Șofer");
    }

    // -----------------------------------------------------------------------
    // TEST 5 — getEmployeesByRole filters correctly
    // -----------------------------------------------------------------------
    @Test
    void getEmployeesByRole_shouldFilterByRole() {
        when(employeeRepository.findAll()).thenReturn(List.of(driver, salesPerson));

        List<Employee> result = employeeService.getEmployeesByRole("SALES");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getFullName()).isEqualTo("Maria Vânzări");
    }

    // -----------------------------------------------------------------------
    // TEST 6 — getEmployeesByRole is case-insensitive
    // -----------------------------------------------------------------------
    @Test
    void getEmployeesByRole_shouldBeCaseInsensitive() {
        when(employeeRepository.findAll()).thenReturn(List.of(driver, salesPerson));

        List<Employee> result = employeeService.getEmployeesByRole("driver");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUsername()).isEqualTo("sofer1");
    }

    // TESTS 7 and 8 (saveEmployee / deleteEmployee) are gone with the methods
    // themselves - see EmployeeService. Employee writes are AdminService's, and
    // AdminServiceTest covers them including the password encoding those two
    // passthroughs skipped.

    // -----------------------------------------------------------------------
    // TEST 9 — getEmployeeByUsername
    // -----------------------------------------------------------------------
    @Test
    void getEmployeeByUsername_shouldReturnEmployee() {
        when(employeeRepository.findByUsername("sofer1")).thenReturn(Optional.of(driver));

        Optional<Employee> result = employeeService.getEmployeeByUsername("sofer1");

        assertThat(result).isPresent();
        assertThat(result.get().getUsername()).isEqualTo("sofer1");
    }
}
