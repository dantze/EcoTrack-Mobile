package com.example.damiProd.controller;

import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.RefreshRequest;
import com.example.damiProd.dto.RefreshResponse;
import com.example.damiProd.dto.SessionResponse;
import com.example.damiProd.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Session endpoints for a device that is ALREADY enrolled.
 *
 * There is no /login and no /google any more - credentials were removed from
 * the system. A device gets its first session from /api/enrollment/claim, once
 * an admin has approved it. Everything here operates on a refresh token the
 * device already holds.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request, HttpServletRequest httpRequest) {
        Optional<RefreshResponse> refreshed = authService.refresh(request.getRefreshToken(), userAgent(httpRequest));
        if (refreshed.isPresent()) {
            return ResponseEntity.ok(refreshed.get());
        }
        return ResponseEntity.status(401)
                .body(Map.of("success", false, "message", "Token de reîmprospătare invalid sau expirat"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequest request) {
        authService.logout(request.getRefreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<EmployeeResponse> me(@AuthenticationPrincipal EmployeePrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(EmployeeResponse.fromEntity(principal.getEmployee()));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionResponse>> listSessions(@AuthenticationPrincipal EmployeePrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(authService.listSessions(principal.getEmployee().getId(), principal.getSessionId()));
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> revokeSession(@PathVariable Long id, @AuthenticationPrincipal EmployeePrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        boolean revoked = authService.revokeSession(principal.getEmployee().getId(), id);
        return revoked ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Void> revokeOtherSessions(@AuthenticationPrincipal EmployeePrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        authService.revokeOtherSessions(principal.getEmployee().getId(), principal.getSessionId());
        return ResponseEntity.noContent().build();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}
