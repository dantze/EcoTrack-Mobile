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
 * Reads "Authorization: Bearer <accessToken>" and, if it validates against a
 * live, unexpired session, populates the SecurityContext for this request.
 *
 * This filter always runs (regardless of ecotrack.security.enforce) so that
 * a valid bearer token is honoured either way; the enforce flag only
 * controls whether the filter chain *requires* authentication to reach an
 * endpoint (see SecurityConfig). A missing/invalid token simply leaves the
 * request anonymous - it is up to the filter chain's authorizeHttpRequests
 * rules to decide whether that is acceptable.
 */
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final TokenService tokenService;

    public BearerTokenAuthenticationFilter(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            Optional<TokenService.AuthenticatedSession> authenticated = tokenService.validateAccessToken(token);
            authenticated.ifPresent(session -> {
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
            });
        }
        filterChain.doFilter(request, response);
    }
}
