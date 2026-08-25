package com.example.damiProd.controller;

import com.example.damiProd.config.EmployeePrincipal;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.GoogleLoginRequest;
import com.example.damiProd.dto.LoginRequest;
import com.example.damiProd.dto.LoginResponse;
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

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        LoginResponse response = authService.login(request, clientIp(httpRequest), userAgent(httpRequest));

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body(response);
        }
    }

    @PostMapping("/google")
    public ResponseEntity<LoginResponse> loginWithGoogle(@RequestBody GoogleLoginRequest request,
            HttpServletRequest httpRequest) {
        LoginResponse response = authService.loginWithGoogle(request.getIdToken(), userAgent(httpRequest));

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(403).body(response);
        }
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

    /**
     * Best-effort caller IP for the login throttle only - never for an
     * authorization decision. X-Forwarded-For is set by whatever proxy sits in
     * front of the app, but nothing stops a direct caller from sending it
     * themselves, so this value is attacker-controlled in the general case.
     * That is precisely why LoginRateLimiter also keeps a per-username counter
     * that does not depend on it.
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}
