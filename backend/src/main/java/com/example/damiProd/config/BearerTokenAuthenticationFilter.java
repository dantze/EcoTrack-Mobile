package com.example.damiProd.config;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.service.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Reads "Authorization: Bearer &lt;accessToken&gt;" and, if it validates against a
 * live, unexpired session, populates the SecurityContext for this request.
 *
 * This filter always runs (regardless of ecotrack.security.enforce) so that
 * a valid bearer token is honoured either way; the enforce flag only
 * controls whether the filter chain *requires* authentication to reach an
 * endpoint (see SecurityConfig).
 *
 * A request with NO Authorization header is left anonymous - that is what keeps
 * the token-less mobile app working while enforcement is off. A request that
 * *does* present a Bearer token which is unknown, expired or revoked is rejected
 * with 401 in both modes ({@code ecotrack.security.reject-invalid-bearer},
 * default true). Without that, a revoked or expired token would keep sailing
 * through the open gate as an anonymous request and the client would never learn
 * its session had ended - a logout or a theft-triggered revocation would look
 * like it had done nothing.
 */
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    /**
     * Opaque tokens are 43 characters of base64url. Anything wildly longer is not
     * one of ours, and hashing it would just be work an unauthenticated caller
     * asked us to do.
     */
    private static final int MAX_TOKEN_LENGTH = 512;

    private final TokenService tokenService;
    private final boolean rejectInvalidBearer;

    public BearerTokenAuthenticationFilter(TokenService tokenService) {
        this(tokenService, true);
    }

    public BearerTokenAuthenticationFilter(TokenService tokenService, boolean rejectInvalidBearer) {
        this.tokenService = tokenService;
        this.rejectInvalidBearer = rejectInvalidBearer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            // No credential presented at all: stays anonymous, the authorization
            // rules decide whether that is acceptable.
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();
        Optional<TokenService.AuthenticatedSession> authenticated = token.length() > MAX_TOKEN_LENGTH
                ? Optional.empty()
                : tokenService.validateAccessToken(token);

        if (authenticated.isEmpty()) {
            if (rejectInvalidBearer) {
                // Never echo the token (or any part of it) back or into the logs.
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        TokenService.AuthenticatedSession session = authenticated.get();
        Employee employee = session.employee();
        List<GrantedAuthority> authorities = employee.getRoles().stream()
                .map(EmployeeRole::getRoleName)
                .map(roleName -> new SimpleGrantedAuthority("ROLE_" + roleName))
                .map(GrantedAuthority.class::cast)
                .toList();

        EmployeePrincipal principal = new EmployeePrincipal(employee, session.sessionId());
        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authToken);

        filterChain.doFilter(request, response);
    }
}
