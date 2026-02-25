package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.repository.EmployeeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    public List<Employee> getAllEmployees() {
        return employeeRepository.findAll();
    }

    public Optional<Employee> getEmployeeById(Long id) {
        return employeeRepository.findById(id);
    }

    public Optional<Employee> getEmployeeByUsername(String username) {
        return employeeRepository.findByUsername(username);
    }

    /**
     * Returnează toți angajații care au rolul de DRIVER
     */
    public List<Employee> getAllDrivers() {
        return employeeRepository.findAll().stream()
                .filter(employee -> employee.getRoles().stream()
                        .anyMatch(role -> "DRIVER".equalsIgnoreCase(role.getRoleName())))
                .collect(Collectors.toList());
    }

    /**
     * Returnează toți angajații cu un anumit rol
     */
    public List<Employee> getEmployeesByRole(String roleName) {
        return employeeRepository.findAll().stream()
                .filter(employee -> employee.getRoles().stream()
                        .anyMatch(role -> roleName.equalsIgnoreCase(role.getRoleName())))
                .collect(Collectors.toList());
    }

    public Employee saveEmployee(Employee employee) {
        return employeeRepository.save(employee);
    }

    public void deleteEmployee(Long id) {
        employeeRepository.deleteById(id);
    }
}
