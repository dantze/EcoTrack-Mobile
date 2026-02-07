package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.LoginRequest;
import com.example.damiProd.dto.LoginResponse;
import com.example.damiProd.repository.EmployeeRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private final EmployeeRepository employeeRepository;

    public AuthService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    public LoginResponse login(LoginRequest request) {
        // Find employee by username
        Optional<Employee> employeeOpt = employeeRepository.findByUsername(request.getUsername());

        if (employeeOpt.isEmpty()) {
            return new LoginResponse(false, "Utilizator inexistent");
        }

        Employee employee = employeeOpt.get();

        // Check password (simple comparison - in production you'd use bcrypt)
        if (!employee.getPassword().equals(request.getPassword())) {
            return new LoginResponse(false, "Parolă incorectă");
        }

        // Build successful response
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setMessage("Autentificare reușită");
        response.setId(employee.getId());
        response.setUsername(employee.getUsername());
        response.setFullName(employee.getFullName());
        response.setPhone(employee.getPhone());
        response.setCounty(employee.getCounty());

        // Extract role names
        Set<String> roleNames = employee.getRoles().stream()
                .map(EmployeeRole::getRoleName)
                .collect(Collectors.toSet());
        response.setRoles(roleNames);

        return response;
    }
}
