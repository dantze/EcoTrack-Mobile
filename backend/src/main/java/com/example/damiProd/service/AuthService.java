package com.example.damiProd.service;

import com.example.damiProd.dto.RefreshResponse;
import com.example.damiProd.dto.SessionResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Session lifecycle for an already-enrolled device: refresh, logout, and the
 * "my devices" list.
 *
 * There is deliberately no login method here. Credentials were removed
 * entirely - no password, no Google - and the only way a session is ever
 * created is {@link EnrollmentService}, where an admin approves a specific
 * device and picks its role. That is what removes password guessing, reuse,
 * sharing and phishing as a class of problem rather than mitigating them.
 */
@Service
public class AuthService {

    private final TokenService tokenService;

    public AuthService(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    public Optional<RefreshResponse> refresh(String refreshToken, String userAgent) {
        return tokenService.rotate(refreshToken, userAgent)
                .map(tokens -> new RefreshResponse(tokens.accessToken(), tokens.refreshToken(),
                        tokens.expiresInSeconds()));
    }

    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenService.revokeByRefreshToken(refreshToken);
        }
    }

    public List<SessionResponse> listSessions(Long employeeId, Long currentSessionId) {
        return tokenService.listActiveSessions(employeeId).stream()
                .map(session -> SessionResponse.fromEntity(session, session.getId().equals(currentSessionId)))
                .collect(Collectors.toList());
    }

    public boolean revokeSession(Long employeeId, Long sessionId) {
        return tokenService.revokeSession(employeeId, sessionId);
    }

    public void revokeOtherSessions(Long employeeId, Long currentSessionId) {
        tokenService.revokeAllOtherSessions(employeeId, currentSessionId);
    }
}
