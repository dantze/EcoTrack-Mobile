package com.example.damiProd.controller;

import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.service.AdminService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    // Admin key from application.properties (default: "ecotrack-admin-2026")
    @Value("${admin.api.key:ecotrack-admin-2026}")
    private String adminApiKey;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /**
     * Validate admin key from request header
     */
    private boolean isValidAdminKey(String providedKey) {
        return adminApiKey != null && adminApiKey.equals(providedKey);
    }

    // ==================== EMPLOYEE ENDPOINTS ====================

    /**
     * GET /api/admin/employees - List all employees
     */
    @GetMapping("/employees")
    public ResponseEntity<?> getAllEmployees(@RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
        return ResponseEntity.ok(adminService.getAllEmployees());
    }

    /**
     * GET /api/admin/employees/{id} - Get specific employee
     */
    @GetMapping("/employees/{id}")
    public ResponseEntity<?> getEmployeeById(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
        return adminService.getEmployeeById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/admin/employees - Create new employee
     */
    @PostMapping("/employees")
    public ResponseEntity<?> createEmployee(
            @RequestBody CreateEmployeeRequest request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
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
    public ResponseEntity<?> updateEmployee(
            @PathVariable Long id,
            @RequestBody CreateEmployeeRequest request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
        return adminService.updateEmployee(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/admin/employees/{id} - Delete employee
     */
    @DeleteMapping("/employees/{id}")
    public ResponseEntity<?> deleteEmployee(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
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
    public ResponseEntity<?> getAllRoles(@RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
        return ResponseEntity.ok(adminService.getAllRoles());
    }

    /**
     * POST /api/admin/roles - Create new role
     */
    @PostMapping("/roles")
    public ResponseEntity<?> createRole(
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        if (!isValidAdminKey(adminKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing admin key"));
        }
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
