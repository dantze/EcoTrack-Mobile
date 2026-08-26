package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private final TokenService tokenService;

    public AdminService(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            TokenService tokenService) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
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
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }

        // No password: nothing logs in with credentials any more. This creates
        // the PERSON (assignable to routes); their device gets access separately,
        // by enrolling and being approved - see EnrollmentService.
        Employee employee = new Employee();
        employee.setUsername(request.getUsername());
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
     * Update an existing employee. This is how someone is promoted to ADMIN or
     * demoted again.
     *
     * A ROLE change revokes every session that employee holds. The access token
     * is only checked for validity per request and authorities are read from the
     * Employee it points at, but revoking is still the right move: a demotion
     * must not leave the old device running on a session granted under the old
     * role, on any of up to 10 enrolled devices.
     */
    @Transactional
    public Optional<EmployeeResponse> updateEmployee(Long id, CreateEmployeeRequest request) {
        return employeeRepository.findById(id).map(employee -> {
            boolean credentialsChanged = false;

            // Update fields if provided
            if (request.getUsername() != null) {
                employee.setUsername(request.getUsername());
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
            throw new IllegalArgumentException("Role already exists: " + upperRoleName);
        }
        EmployeeRole role = new EmployeeRole(upperRoleName);
        return employeeRoleRepository.save(role).getRoleName();
    }
}
