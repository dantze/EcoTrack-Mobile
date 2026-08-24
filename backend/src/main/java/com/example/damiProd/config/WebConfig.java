package com.example.damiProd.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS used to be configured here with allowedOrigins("*"), which is unsafe
 * once requests can carry credentials (Authorization headers / cookies) and
 * was also missing PATCH from allowedMethods (the TaskController PATCH
 * endpoints were relying on the browser never sending a real preflight, or
 * were simply broken for browser callers).
 *
 * CORS is now configured in {@link SecurityConfig} via a single
 * CorsConfigurationSource bean (ecotrack.cors.allowed-origins), because
 * Spring Security's filter chain needs to own CORS once it's on the
 * classpath - keeping a second, separate WebMvcConfigurer CORS registration
 * here would risk the two disagreeing or double-adding headers.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
}
