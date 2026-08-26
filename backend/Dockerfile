# =========================================================================
# Multi-stage Dockerfile for Spring Boot EcoTrack Backend
# =========================================================================

# --- Stage 1: Build the application ---
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /workspace

# Install bash/curl for build tooling if needed
RUN apk add --no-cache bash

# Copy gradle wrapper files first to leverage Docker layer caching
COPY gradlew .
COPY gradle ./gradle
COPY build.gradle settings.gradle ./

# Give execute permissions to gradlew
RUN chmod +x gradlew

# Download dependencies (cached unless build.gradle changes)
RUN ./gradlew dependencies --no-daemon || true

# Copy source code
COPY src ./src

# Build production jar without running tests (tests run in CI)
RUN ./gradlew bootJar --no-daemon -x test

# --- Stage 2: Minimal, secure runtime container ---
FROM eclipse-temurin:21-jre-alpine AS runtime

# Install curl for container health checks
RUN apk add --no-cache curl tzdata

# Create an unprivileged non-root user and group
RUN addgroup -S ecotrack && adduser -S ecotrack -G ecotrack

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder --chown=ecotrack:ecotrack /workspace/build/libs/*.jar app.jar

# Switch to non-root user
USER ecotrack:ecotrack

# Default port for Spring Boot
EXPOSE 8080

# Environment variables with sensible defaults
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

# Healthcheck targeting Spring Boot Actuator
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

# Launch application with JVM options
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
