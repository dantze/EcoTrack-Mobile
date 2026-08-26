package com.example.damiProd.controller;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.service.EmployeeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Read-only employee directory. Every write lives on
 * {@link AdminController} (/api/admin/employees) instead.
 *
 * This controller used to also expose POST /api/employees and
 * DELETE /api/employees/{id}, both binding the raw {@link Employee} JPA entity
 * straight from the request body. That was a privilege-escalation hole: the
 * body carried its own `roles` list, so any caller who could reach the endpoint
 * could mint themselves an ADMIN, and `password` was persisted exactly as sent
 * - in plaintext, bypassing the encoder. Neither endpoint had a caller: the web
 * app and the mobile app both write through /api/admin/employees, which takes a
 * CreateEmployeeRequest DTO, bcrypts the password and resolves role names
 * against the role table.
 *
 * If you need a write here, add it to AdminController - do not re-add an
 * entity-bound one.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping
    public ResponseEntity<List<Employee>> getAllEmployees() {
        return ResponseEntity.ok(employeeService.getAllEmployees());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Employee> getEmployeeById(@PathVariable Long id) {
        return employeeService.getEmployeeById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Endpoint pentru a obține toți șoferii
     */
    @GetMapping("/drivers")
    public ResponseEntity<List<Employee>> getAllDrivers() {
        return ResponseEntity.ok(employeeService.getAllDrivers());
    }

    /**
     * Endpoint pentru a obține angajații cu un anumit rol
     */
    @GetMapping("/role/{roleName}")
    public ResponseEntity<List<Employee>> getEmployeesByRole(@PathVariable String roleName) {
        return ResponseEntity.ok(employeeService.getEmployeesByRole(roleName));
    }
}
