package com.example.damiProd.controller;

import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only employee/role management.
 *
 * Used to be gated by a shared X-Admin-Key header; that has been removed.
 * Authorization is now purely role-based: SecurityConfig requires the
 * caller's access token to carry the ADMIN role for every /api/admin/**
 * request (when ecotrack.security.enforce=true). When enforcement is off,
 * these endpoints are open like the rest of /api/**, same as before.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    // ==================== EMPLOYEE ENDPOINTS ====================

    /**
     * GET /api/admin/employees - List all employees
     */
    @GetMapping("/employees")
    public ResponseEntity<?> getAllEmployees() {
        return ResponseEntity.ok(adminService.getAllEmployees());
    }

    /**
     * GET /api/admin/employees/{id} - Get specific employee
     */
    @GetMapping("/employees/{id}")
    public ResponseEntity<?> getEmployeeById(@PathVariable Long id) {
        return adminService.getEmployeeById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/admin/employees - Create new employee
     */
    @PostMapping("/employees")
    public ResponseEntity<?> createEmployee(@RequestBody CreateEmployeeRequest request) {
        try {
            EmployeeResponse created = adminService.createEmployee(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/employees/{id} - Update employee
     */
    @PutMapping("/employees/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable Long id, @RequestBody CreateEmployeeRequest request) {
        return adminService.updateEmployee(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/admin/employees/{id} - Delete employee
     */
    @DeleteMapping("/employees/{id}")
    public ResponseEntity<?> deleteEmployee(@PathVariable Long id) {
        if (adminService.deleteEmployee(id)) {
            return ResponseEntity.ok(Map.of("message", "Employee deleted successfully"));
        }
        return ResponseEntity.notFound().build();
    }

    // ==================== ROLE ENDPOINTS ====================

    /**
     * GET /api/admin/roles - List all roles
     */
    @GetMapping("/roles")
    public ResponseEntity<?> getAllRoles() {
        return ResponseEntity.ok(adminService.getAllRoles());
    }

    /**
     * POST /api/admin/roles - Create new role
     */
    @PostMapping("/roles")
    public ResponseEntity<?> createRole(@RequestBody Map<String, String> request) {
        String roleName = request.get("roleName");
        if (roleName == null || roleName.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role name is required"));
        }
        try {
            String created = adminService.createRole(roleName);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("roleName", created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
