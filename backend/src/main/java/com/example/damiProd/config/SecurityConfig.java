package com.example.damiProd.config;

import com.example.damiProd.service.TokenService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Wires up token-based auth for the API.
 *
 * IMPORTANT: {@code ecotrack.security.enforce} controls whether unauthenticated
 * requests to /api/** are rejected. It does NOT control whether the auth
 * machinery itself works - login/refresh/logout/sessions always work, and a
 * valid bearer token is always honoured by {@link BearerTokenAuthenticationFilter}.
 * When the flag is false, /api/** simply stays open to anonymous requests too,
 * which is what keeps the current React Native app (which sends no tokens)
 * working in production until it is updated.
 *
 * See README.md for the full list of related properties and what an
 * operator must do to flip this on.
 */
@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Value("${ecotrack.security.enforce:false}")
    private boolean enforceSecurity;

    @Value("${ecotrack.cors.allowed-origins:http://localhost:5173}")
    private String allowedOriginsProperty;

    @PostConstruct
    void logEnforcementMode() {
        // Deliberately loud: an operator must never be unsure which mode is live.
        log.info("====================================================================");
        if (enforceSecurity) {
            log.info("EcoTrack security ENFORCEMENT IS ON (ecotrack.security.enforce=true).");
            log.info("  -> /api/** requires a valid Bearer access token.");
            log.info("  -> /api/admin/** additionally requires the ADMIN role.");
        } else {
            log.warn("EcoTrack security enforcement is OFF (ecotrack.security.enforce=false).");
            log.warn("  -> /api/** accepts unauthenticated requests (legacy/mobile compatibility mode).");
            log.warn("  -> Token issuance/validation still works; only the gate is open.");
        }
        log.info("====================================================================");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOriginsProperty.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, TokenService tokenService,
            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new BearerTokenAuthenticationFilter(tokenService),
                        UsernamePasswordAuthenticationFilter.class)
                // Plain status codes, no redirect-to-login-page: this is a token API,
                // never an HTML login flow.
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) ->
                                response.sendError(HttpServletResponse.SC_UNAUTHORIZED))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                response.sendError(HttpServletResponse.SC_FORBIDDEN)));

        if (enforceSecurity) {
            http.authorizeHttpRequests(auth -> auth
                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/google",
                            "/api/auth/refresh", "/api/auth/logout")
                    .permitAll()
                    .requestMatchers("/api/admin/**").hasRole("ADMIN")
                    .requestMatchers("/api/**").authenticated()
                    .anyRequest().permitAll());
        } else {
            // Enforcement off: everything stays open, but the filter above still
            // populates the SecurityContext for anyone who *does* send a token,
            // so web clients can already rely on auth working end-to-end.
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        }

        return http.build();
    }
}
