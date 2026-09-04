package com.example.damiProd.controller;

import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.SessionResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
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

    // Same wording AdminService already uses for this row (see its own lookup
    // at AdminService:303), so the API does not describe one missing employee
    // two ways.
    private static final String EMPLOYEE_NOT_FOUND = "Angajatul nu a fost găsit";

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

    // ─── One error shape, GlobalExceptionHandler's (TODO-76) ────────────────
    //
    // These four used to hand-roll three different answers between them: a
    // bare 404 with no body, a 200 carrying an English {"message": ...} nobody
    // read, and a 400 {"error": ...} with no `message` key at all. The rest of
    // the API has ONE envelope - {timestamp, status, error, message} - built by
    // GlobalExceptionHandler.
    //
    // It stopped being cosmetic when the web app began surfacing the server's
    // own Romanian text (TODO-51): `serverMessage` reads `.message`, so
    // createEmployee's {"error": ...} returned null and "this username is
    // taken" - the one message that method exists to produce - was replaced by
    // a generic fallback.
    //
    // So they throw now, and the handler answers. The service already threw the
    // right types; the controller was catching them and flattening them.

    /**
     * GET /api/admin/employees/{id} - Get specific employee
     */
    @GetMapping("/employees/{id}")
    public ResponseEntity<?> getEmployeeById(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getEmployeeById(id)
                .orElseThrow(() -> new ResourceNotFoundException(EMPLOYEE_NOT_FOUND)));
    }

    /**
     * POST /api/admin/employees - Create new employee
     */
    @PostMapping("/employees")
    public ResponseEntity<?> createEmployee(@RequestBody CreateEmployeeRequest request) {
        // No try/catch. It used to catch RuntimeException, which is wider than
        // it looks: the last-admin guards throw IllegalStateException and are
        // meant to be 409s, so anything of theirs reaching this method would
        // have been downgraded to a 400 with the wrong shape.
        EmployeeResponse created = adminService.createEmployee(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * PUT /api/admin/employees/{id} - Update employee
     */
    @PutMapping("/employees/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable Long id, @RequestBody CreateEmployeeRequest request) {
        return ResponseEntity.ok(adminService.updateEmployee(id, request)
                .orElseThrow(() -> new ResourceNotFoundException(EMPLOYEE_NOT_FOUND)));
    }

    /**
     * DELETE /api/admin/employees/{id} - Delete employee
     *
     * <p>204, not a 200 carrying "Employee deleted successfully": nothing read
     * that string, it was English in an app whose user-facing text is Romanian,
     * and a delete has no body worth sending.
     */
    @DeleteMapping("/employees/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {
        if (!adminService.deleteEmployee(id)) {
            throw new ResourceNotFoundException(EMPLOYEE_NOT_FOUND);
        }
        return ResponseEntity.noContent().build();
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
    // Same treatment as the employee endpoints above (TODO-76): this had both
    // of the old shapes in one method.
    @PostMapping("/roles")
    public ResponseEntity<?> createRole(@RequestBody Map<String, String> request) {
        String roleName = request.get("roleName");
        if (roleName == null || roleName.isBlank()) {
            throw new IllegalArgumentException("Numele rolului este obligatoriu.");
        }
        String created = adminService.createRole(roleName);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("roleName", created));
    }
}
