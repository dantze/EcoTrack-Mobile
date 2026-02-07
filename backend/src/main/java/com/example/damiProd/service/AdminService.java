package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;

    public AdminService(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
    }

    /**
     * Get all employees
     */
    public List<EmployeeResponse> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(EmployeeResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get employee by ID
     */
    public Optional<EmployeeResponse> getEmployeeById(Long id) {
        return employeeRepository.findById(id)
                .map(EmployeeResponse::fromEntity);
    }

    /**
     * Create a new employee
     */
    @Transactional
    public EmployeeResponse createEmployee(CreateEmployeeRequest request) {
        // Check if username already exists
        if (employeeRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists: " + request.getUsername());
        }

        Employee employee = new Employee();
        employee.setUsername(request.getUsername());
        employee.setPassword(request.getPassword());
        employee.setFullName(request.getFullName());
        employee.setPhone(request.getPhone());
        employee.setCounty(request.getCounty());

        // Save employee first
        Employee saved = employeeRepository.save(employee);

        // Add roles
        if (request.getRoleNames() != null && !request.getRoleNames().isEmpty()) {
            Set<EmployeeRole> roles = new HashSet<>();
            for (String roleName : request.getRoleNames()) {
                EmployeeRole role = employeeRoleRepository.findByRoleName(roleName.toUpperCase())
                        .orElseGet(() -> {
                            // Create role if it doesn't exist
                            EmployeeRole newRole = new EmployeeRole(roleName.toUpperCase());
                            return employeeRoleRepository.save(newRole);
                        });
                roles.add(role);
            }
            saved.setRoles(roles);
            saved = employeeRepository.save(saved);
        }

        return EmployeeResponse.fromEntity(saved);
    }

    /**
     * Update an existing employee
     */
    @Transactional
    public Optional<EmployeeResponse> updateEmployee(Long id, CreateEmployeeRequest request) {
        return employeeRepository.findById(id).map(employee -> {
            // Update fields if provided
            if (request.getUsername() != null) {
                employee.setUsername(request.getUsername());
            }
            if (request.getPassword() != null && !request.getPassword().isEmpty()) {
                employee.setPassword(request.getPassword());
            }
            if (request.getFullName() != null) {
                employee.setFullName(request.getFullName());
            }
            if (request.getPhone() != null) {
                employee.setPhone(request.getPhone());
            }
            if (request.getCounty() != null) {
                employee.setCounty(request.getCounty());
            }

            // Update roles if provided
            if (request.getRoleNames() != null && !request.getRoleNames().isEmpty()) {
                Set<EmployeeRole> roles = new HashSet<>();
                for (String roleName : request.getRoleNames()) {
                    EmployeeRole role = employeeRoleRepository.findByRoleName(roleName.toUpperCase())
                            .orElseGet(() -> {
                                EmployeeRole newRole = new EmployeeRole(roleName.toUpperCase());
                                return employeeRoleRepository.save(newRole);
                            });
                    roles.add(role);
                }
                employee.setRoles(roles);
            }

            Employee saved = employeeRepository.save(employee);
            return EmployeeResponse.fromEntity(saved);
        });
    }

    /**
     * Delete an employee
     */
    @Transactional
    public boolean deleteEmployee(Long id) {
        if (employeeRepository.existsById(id)) {
            employeeRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * Get all available roles
     */
    public List<String> getAllRoles() {
        return employeeRoleRepository.findAll().stream()
                .map(EmployeeRole::getRoleName)
                .collect(Collectors.toList());
    }

    /**
     * Create a new role
     */
    @Transactional
    public String createRole(String roleName) {
        String upperRoleName = roleName.toUpperCase();
        if (employeeRoleRepository.findByRoleName(upperRoleName).isPresent()) {
            throw new RuntimeException("Role already exists: " + upperRoleName);
        }
        EmployeeRole role = new EmployeeRole(upperRoleName);
        return employeeRoleRepository.save(role).getRoleName();
    }
}
