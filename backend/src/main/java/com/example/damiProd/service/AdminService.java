package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public AdminService(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            PasswordEncoder passwordEncoder,
            TokenService tokenService) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
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
        employee.setPassword(passwordEncoder.encode(request.getPassword()));
        employee.setFullName(request.getFullName());
        employee.setPhone(request.getPhone());
        employee.setCounty(request.getCounty());
        employee.setEmail(request.getEmail());

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
     * Update an existing employee.
     *
     * A password or role change also revokes every session the employee has.
     * Without that, the credentials being replaced here - which is what an admin
     * does when an account is compromised or someone leaves - keep working for
     * up to the refresh-token lifetime (60 days by default), on every device
     * that ever logged in. Changing the password would look like it locked the
     * old holder out while doing nothing of the sort.
     *
     * Roles are included because the access token is only checked for validity
     * on each request; authorities are read from the Employee it points at, but
     * a stale session is exactly the kind of thing a demotion is meant to end.
     */
    @Transactional
    public Optional<EmployeeResponse> updateEmployee(Long id, CreateEmployeeRequest request) {
        return employeeRepository.findById(id).map(employee -> {
            boolean credentialsChanged = false;

            // Update fields if provided
            if (request.getUsername() != null) {
                employee.setUsername(request.getUsername());
            }
            if (request.getPassword() != null && !request.getPassword().isEmpty()) {
                employee.setPassword(passwordEncoder.encode(request.getPassword()));
                credentialsChanged = true;
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
            if (request.getEmail() != null) {
                employee.setEmail(request.getEmail());
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
                if (!roles.equals(employee.getRoles())) {
                    credentialsChanged = true;
                }
                employee.setRoles(roles);
            }

            Employee saved = employeeRepository.save(employee);

            if (credentialsChanged) {
                int revoked = tokenService.revokeAllSessions(saved.getId(), "CREDENTIALS_CHANGED_BY_ADMIN");
                if (revoked > 0) {
                    log.info("Revoked {} session(s) for employee id={} after an admin credential change",
                            revoked, saved.getId());
                }
            }

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
