package com.example.damiProd.controller;

import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.EnrollmentClaimBody;
import com.example.damiProd.dto.EnrollmentRequestBody;
import com.example.damiProd.dto.EnrollmentRequestResponse;
import com.example.damiProd.dto.LoginResponse;
import com.example.damiProd.service.EnrollmentService;
import com.example.damiProd.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * The only unauthenticated surface in the app, and the only way in.
 *
 * Both endpoints are necessarily public - a device has no credential yet - so
 * they assume hostile input and hand out nothing an attacker can use: /request
 * returns a secret only to the caller that created the row, and /claim returns
 * tokens only for a request an admin has already approved.
 */
@RestController
@RequestMapping("/api/enrollment")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    public EnrollmentController(EnrollmentService enrollmentService) {
        this.enrollmentService = enrollmentService;
    }

    /**
     * Lets the login screen decide what to render: on a fresh install it shows
     * the setup-code field, afterwards just the name and the button. Leaks
     * nothing beyond "has anyone claimed this server yet".
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "awaitingBootstrap", enrollmentService.isAwaitingBootstrap(),
                "setupCodeRequired", enrollmentService.setupCodeRequired()));
    }

    @PostMapping("/request")
    public ResponseEntity<?> request(@RequestBody EnrollmentRequestBody body, HttpServletRequest httpRequest) {
        EnrollmentService.RequestResult result = enrollmentService.request(
                body.getFullName(), body.getDeviceId(),
                body.getDeviceLabel() != null ? body.getDeviceLabel() : httpRequest.getHeader("User-Agent"),
                body.getSetupCode());

        return switch (result.outcome()) {
            case CREATED -> {
                EnrollmentRequestResponse response = result.response();
                yield ResponseEntity.ok(Map.of(
                        "requestId", response.requestId(),
                        "claimSecret", response.claimSecret(),
                        "verificationCode", response.verificationCode(),
                        "expiresAt", response.expiresAt().toString(),
                        // Tells the client to skip the waiting screen entirely.
                        "autoApproved", result.bootstrapped()));
            }
            case BAD_INPUT -> ResponseEntity.badRequest()
                    .body(Map.of("message", "Nume sau dispozitiv invalid"));
            case BAD_SETUP_CODE -> ResponseEntity.status(403)
                    .body(Map.of("message", "Cod de configurare invalid"));
            case RATE_LIMITED -> ResponseEntity.status(429)
                    .body(Map.of("message", "Prea multe cereri. Încearcă din nou mai târziu."));
        };
    }

    /**
     * Polled by the waiting screen. 202 means "keep waiting" - deliberately not
     * an error, so the client can poll without treating it as a failure.
     */
    @PostMapping("/claim")
    public ResponseEntity<?> claim(@RequestBody EnrollmentClaimBody body, HttpServletRequest httpRequest) {
        EnrollmentService.ClaimResult result = enrollmentService.claim(
                body.getRequestId(), body.getClaimSecret(), httpRequest.getHeader("User-Agent"));

        return switch (result.outcome()) {
            case ISSUED -> {
                TokenService.IssuedTokens tokens = result.tokens();
                LoginResponse response = new LoginResponse();
                response.setSuccess(true);
                response.setAccessToken(tokens.accessToken());
                response.setRefreshToken(tokens.refreshToken());
                response.setExpiresIn(tokens.expiresInSeconds());
                response.setUser(EmployeeResponse.fromEntity(result.employee()));
                response.setId(result.employee().getId());
                response.setUsername(result.employee().getUsername());
                response.setFullName(result.employee().getFullName());
                response.setRoles(response.getUser().getRoles());
                yield ResponseEntity.ok(response);
            }
            case PENDING -> ResponseEntity.status(202).body(Map.of("status", "PENDING"));
            case REJECTED -> ResponseEntity.status(403).body(Map.of("status", "REJECTED",
                    "message", "Cererea a fost respinsă"));
            case EXPIRED -> ResponseEntity.status(410).body(Map.of("status", "EXPIRED",
                    "message", "Cererea a expirat. Trimite o cerere nouă."));
            // Unknown id and wrong secret answer identically: telling them apart
            // would confirm which request ids exist.
            case UNKNOWN -> ResponseEntity.status(404).body(Map.of("status", "UNKNOWN"));
        };
    }
}
