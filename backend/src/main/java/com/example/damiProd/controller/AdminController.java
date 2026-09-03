package com.example.damiProd.controller;

import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.SessionResponse;
import com.example.damiProd.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    // ==================== SESSION ENDPOINTS (TODO-56) ====================

    // Somebody ELSE's devices. The self-scoped equivalents live on
    // /api/auth/sessions and stay self-scoped: AuthController passes the
    // caller's own employee id, these pass the one in the URL.
    //
    // No SecurityConfig row is needed for any of the three - /api/admin/**
    // already requires ADMIN and is matched ABOVE the office-staff DELETE
    // catch-all, so a SALES token gets 403 here without anything being added.
    // AuthorizationMatrixTest asserts that rather than assuming it.

    /**
     * GET /api/admin/employees/{id}/sessions - the devices holding a live
     * refresh token for that employee, newest use first.
     */
    @GetMapping("/employees/{id}/sessions")
    public ResponseEntity<List<SessionResponse>> listSessions(@PathVariable Long id,
            @AuthenticationPrincipal EmployeePrincipal principal) {
        return ResponseEntity.ok(adminService.listSessions(id, callerSessionId(principal)));
    }

    /**
     * DELETE /api/admin/employees/{id}/sessions/{sessionId} - revoke one device.
     * 404 when that session is not that employee's.
     */
    @DeleteMapping("/employees/{id}/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(@PathVariable Long id, @PathVariable Long sessionId) {
        return adminService.revokeSession(id, sessionId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    /**
     * DELETE /api/admin/employees/{id}/sessions - revoke every device, except
     * the caller's own if the admin is looking at themselves (see
     * AdminService#revokeAllSessions).
     *
     * Answers with the count because the screen says "3 sesiuni au fost
     * revocate", and because 0 is a meaningful answer: the phone was already
     * dead.
     */
    @DeleteMapping("/employees/{id}/sessions")
    public ResponseEntity<Map<String, Integer>> revokeAllSessions(@PathVariable Long id,
            @AuthenticationPrincipal EmployeePrincipal principal) {
        int revoked = adminService.revokeAllSessions(id, callerSessionId(principal));
        return ResponseEntity.ok(Map.of("revoked", revoked));
    }

    /**
     * Null when nobody is authenticated, which happens only while
     * {@code ecotrack.security.enforce=false} leaves /api/** open. Nothing is
     * then marked as the current device and nothing is spared, which is the
     * right answer for a caller the app cannot identify.
     */
    private static Long callerSessionId(EmployeePrincipal principal) {
        return principal == null ? null : principal.getSessionId();
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
