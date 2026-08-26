package com.example.damiProd.service;

import com.example.damiProd.domain.AccessRequest;
import com.example.damiProd.domain.AccessRequestStatus;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.EnrollmentRequestResponse;
import com.example.damiProd.repository.AccessRequestRepository;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Device enrollment: the only way anyone gets into this system.
 *
 * There is no password and no self-registration. A device asks, an admin
 * approves it and picks a role, and the device exchanges a one-time secret for
 * session tokens. See {@link AccessRequest} for what each field protects.
 *
 * FIRST RUN. With an empty employees table nobody can approve anything, so the
 * first request is auto-approved as ADMIN - that is the "first user to open the
 * app is the admin" rule. Left bare that is a land-grab: whoever reaches a
 * freshly deployed server first owns it, permanently, with no password path to
 * take it back. So unless {@code ecotrack.enrollment.require-setup-code} is
 * turned off, that first request must also carry a one-time code printed to the
 * server log at startup. It is not a password: single-use, never stored, gone
 * the moment an admin exists.
 */
@Service
public class EnrollmentService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private static final int MAX_NAME_LENGTH = 120;
    private static final int MAX_DEVICE_ID_LENGTH = 128;
    private static final int MAX_DEVICE_LABEL_LENGTH = 200;
    private static final Set<String> ASSIGNABLE_ROLES = Set.of("ADMIN", "SALES", "TECH", "DRIVER");

    private final AccessRequestRepository accessRequestRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final TokenService tokenService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${ecotrack.enrollment.request-ttl-minutes:10}")
    private int requestTtlMinutes;

    @Value("${ecotrack.enrollment.claim-ttl-minutes:10}")
    private int claimTtlMinutes;

    @Value("${ecotrack.enrollment.require-setup-code:true}")
    private boolean requireSetupCode;

    @Value("${ecotrack.enrollment.max-requests-per-device-per-hour:5}")
    private int maxRequestsPerDevicePerHour;

    /**
     * The first-run code. Held in memory only and never persisted: a restart
     * before anyone enrolls mints a new one, which is the safe direction.
     */
    private volatile String setupCode;

    public EnrollmentService(AccessRequestRepository accessRequestRepository,
            EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            TokenService tokenService) {
        this.accessRequestRepository = accessRequestRepository;
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
        this.tokenService = tokenService;
    }

    // ------------------------------------------------------------------ first run

    @EventListener(ApplicationReadyEvent.class)
    public void announceSetupCodeIfUnclaimed() {
        if (employeeRepository.count() > 0) {
            return;
        }
        if (!requireSetupCode) {
            log.warn("No employees exist and require-setup-code is OFF: the next enrollment request "
                    + "becomes ADMIN with no further checks.");
            return;
        }
        setupCode = randomSetupCode();
        log.warn("""
                
                ==========================================================
                 SETUP: no employees exist yet.
                 First-run admin code: {}
                 Enter it on the access-request screen to claim this
                 instance. It is single-use and is not stored anywhere.
                ==========================================================
                """, setupCode);
    }

    /** True while nobody has claimed this instance yet. */
    public boolean isAwaitingBootstrap() {
        return employeeRepository.count() == 0;
    }

    /** Drives the mobile/web UI: only show the setup-code field when it is needed. */
    public boolean setupCodeRequired() {
        return requireSetupCode && isAwaitingBootstrap();
    }

    // ------------------------------------------------------------------ requesting

    public enum RequestOutcome { CREATED, BAD_INPUT, BAD_SETUP_CODE, RATE_LIMITED }

    public record RequestResult(RequestOutcome outcome, EnrollmentRequestResponse response, boolean bootstrapped) {
        static RequestResult fail(RequestOutcome outcome) {
            return new RequestResult(outcome, null, false);
        }
    }

    @Transactional
    public RequestResult request(String fullName, String deviceId, String deviceLabel, String providedSetupCode) {
        String name = trimToNull(fullName);
        String device = trimToNull(deviceId);
        if (name == null || name.length() > MAX_NAME_LENGTH
                || device == null || device.length() > MAX_DEVICE_ID_LENGTH) {
            return RequestResult.fail(RequestOutcome.BAD_INPUT);
        }

        // Cheap flood guard. The endpoint is public by necessity: someone has to
        // be able to ask before they have any credential at all.
        long recent = accessRequestRepository.countByDeviceIdAndCreatedAtAfter(
                device, Instant.now().minus(1, ChronoUnit.HOURS));
        if (recent >= maxRequestsPerDevicePerHour) {
            return RequestResult.fail(RequestOutcome.RATE_LIMITED);
        }

        boolean bootstrap = isAwaitingBootstrap();
        if (bootstrap && requireSetupCode && !setupCodeMatches(providedSetupCode)) {
            log.warn("Bootstrap enrollment refused: wrong or missing setup code");
            return RequestResult.fail(RequestOutcome.BAD_SETUP_CODE);
        }

        String claimSecret = randomSecret();
        Instant now = Instant.now();

        AccessRequest request = new AccessRequest();
        request.setFullName(name);
        request.setDeviceId(device);
        request.setDeviceLabel(truncate(deviceLabel, MAX_DEVICE_LABEL_LENGTH));
        request.setClaimSecretHash(sha256(claimSecret));
        request.setVerificationCode(randomVerificationCode());
        request.setCreatedAt(now);
        request.setExpiresAt(now.plus(requestTtlMinutes, ChronoUnit.MINUTES));
        request.setStatus(AccessRequestStatus.PENDING);

        if (bootstrap) {
            // Approved inline, and the Employee is created NOW rather than at
            // claim time. That is deliberate: it makes the employees table
            // non-empty immediately, so a second device requesting a moment
            // later no longer sees an unclaimed instance and cannot also be
            // auto-promoted to ADMIN.
            grant(request, "ADMIN", null, now);
            setupCode = null;
            log.warn("Bootstrap: '{}' claimed this instance as ADMIN", name);
        }

        accessRequestRepository.save(request);
        return new RequestResult(
                RequestOutcome.CREATED,
                new EnrollmentRequestResponse(request.getId(), claimSecret,
                        request.getVerificationCode(), request.getExpiresAt()),
                bootstrap);
    }

    // ------------------------------------------------------------------ claiming

    public enum ClaimOutcome { ISSUED, PENDING, REJECTED, EXPIRED, UNKNOWN }

    public record ClaimResult(ClaimOutcome outcome, Employee employee, TokenService.IssuedTokens tokens) {
        static ClaimResult of(ClaimOutcome outcome) {
            return new ClaimResult(outcome, null, null);
        }
    }

    @Transactional
    public ClaimResult claim(Long requestId, String claimSecret, String deviceLabel) {
        if (requestId == null || trimToNull(claimSecret) == null) {
            return ClaimResult.of(ClaimOutcome.UNKNOWN);
        }
        Optional<AccessRequest> found = accessRequestRepository.findById(requestId);
        if (found.isEmpty()) {
            return ClaimResult.of(ClaimOutcome.UNKNOWN);
        }
        AccessRequest request = found.get();

        // Constant-time: a timing difference here would let an attacker walk the
        // secret a byte at a time.
        if (!MessageDigest.isEqual(
                sha256(claimSecret).getBytes(StandardCharsets.UTF_8),
                request.getClaimSecretHash().getBytes(StandardCharsets.UTF_8))) {
            return ClaimResult.of(ClaimOutcome.UNKNOWN);
        }

        Instant now = Instant.now();
        if (request.getStatus() == AccessRequestStatus.PENDING && request.isExpiredAt(now)) {
            request.setStatus(AccessRequestStatus.EXPIRED);
            accessRequestRepository.save(request);
            return ClaimResult.of(ClaimOutcome.EXPIRED);
        }

        return switch (request.getStatus()) {
            case PENDING -> ClaimResult.of(ClaimOutcome.PENDING);
            case REJECTED -> ClaimResult.of(ClaimOutcome.REJECTED);
            // Single-use: a secret already exchanged for tokens is spent. Re-presenting
            // one means a copy leaked, so it must never mint a second session.
            case CLAIMED, EXPIRED -> ClaimResult.of(ClaimOutcome.EXPIRED);
            case APPROVED -> issueFor(request, deviceLabel, now);
        };
    }

    private ClaimResult issueFor(AccessRequest request, String deviceLabel, Instant now) {
        if (request.isExpiredAt(now)) {
            request.setStatus(AccessRequestStatus.EXPIRED);
            accessRequestRepository.save(request);
            return ClaimResult.of(ClaimOutcome.EXPIRED);
        }
        Employee employee = employeeRepository.findById(request.getCreatedEmployeeId()).orElse(null);
        if (employee == null) {
            log.error("Approved request {} has no employee - refusing to issue tokens", request.getId());
            return ClaimResult.of(ClaimOutcome.UNKNOWN);
        }
        TokenService.IssuedTokens tokens = tokenService.issueNewSession(
                employee, deviceLabel != null ? deviceLabel : request.getDeviceLabel());
        request.setStatus(AccessRequestStatus.CLAIMED);
        accessRequestRepository.save(request);
        log.info("Enrollment claimed: employee id={} role={}", employee.getId(), request.getAssignedRoleName());
        return new ClaimResult(ClaimOutcome.ISSUED, employee, tokens);
    }

    // ------------------------------------------------------------------ admin side

    @Transactional(readOnly = true)
    public List<AccessRequest> listRequests() {
        Instant now = Instant.now();
        return accessRequestRepository
                .findByStatusInOrderByCreatedAtDesc(
                        List.of(AccessRequestStatus.PENDING, AccessRequestStatus.APPROVED))
                .stream()
                // Lazy expiry: a row whose window closed is dead even if a sweeper
                // has not rewritten it yet, and must not be offered for approval.
                .filter(r -> !r.isExpiredAt(now))
                .toList();
    }

    public enum DecisionOutcome { OK, NOT_FOUND, NOT_PENDING, EXPIRED, BAD_ROLE }

    @Transactional
    public DecisionOutcome approve(Long requestId, String roleName, Long adminEmployeeId) {
        String role = roleName == null ? null : roleName.trim().toUpperCase(Locale.ROOT);
        if (role == null || !ASSIGNABLE_ROLES.contains(role)) {
            return DecisionOutcome.BAD_ROLE;
        }
        Optional<AccessRequest> found = accessRequestRepository.findById(requestId);
        if (found.isEmpty()) {
            return DecisionOutcome.NOT_FOUND;
        }
        AccessRequest request = found.get();
        if (request.getStatus() != AccessRequestStatus.PENDING) {
            return DecisionOutcome.NOT_PENDING;
        }
        Instant now = Instant.now();
        if (request.isExpiredAt(now)) {
            request.setStatus(AccessRequestStatus.EXPIRED);
            accessRequestRepository.save(request);
            return DecisionOutcome.EXPIRED;
        }
        grant(request, role, adminEmployeeId, now);
        accessRequestRepository.save(request);
        log.info("Access request {} approved as {} by employee {}", requestId, role, adminEmployeeId);
        return DecisionOutcome.OK;
    }

    @Transactional
    public DecisionOutcome reject(Long requestId, Long adminEmployeeId) {
        Optional<AccessRequest> found = accessRequestRepository.findById(requestId);
        if (found.isEmpty()) {
            return DecisionOutcome.NOT_FOUND;
        }
        AccessRequest request = found.get();
        if (request.getStatus() != AccessRequestStatus.PENDING) {
            return DecisionOutcome.NOT_PENDING;
        }
        request.setStatus(AccessRequestStatus.REJECTED);
        request.setDecidedAt(Instant.now());
        request.setDecidedByEmployeeId(adminEmployeeId);
        accessRequestRepository.save(request);
        return DecisionOutcome.OK;
    }

    /**
     * Marks the request approved and creates the Employee it grants.
     *
     * The employee is created here, at approval, not at claim: the admin sees
     * the person in the employees list the moment they approve, and the
     * bootstrap race described on this class closes.
     */
    private void grant(AccessRequest request, String roleName, Long adminEmployeeId, Instant now) {
        EmployeeRole role = employeeRoleRepository.findByRoleName(roleName)
                .orElseGet(() -> employeeRoleRepository.save(new EmployeeRole(roleName)));

        Employee employee = new Employee();
        employee.setUsername(uniqueUsername(request.getFullName()));
        employee.setFullName(request.getFullName());
        employee.setRoles(Set.of(role));
        employee = employeeRepository.save(employee);

        request.setStatus(AccessRequestStatus.APPROVED);
        request.setAssignedRoleName(roleName);
        request.setDecidedAt(now);
        request.setDecidedByEmployeeId(adminEmployeeId);
        request.setCreatedEmployeeId(employee.getId());
        // The approval itself is short-lived: an approved request the device never
        // collects must not stay claimable indefinitely.
        request.setExpiresAt(now.plus(claimTtlMinutes, ChronoUnit.MINUTES));
    }

    // ------------------------------------------------------------------ helpers

    /**
     * `username` survives as a stable, human-readable handle for existing screens
     * and for uniqueness - it is no longer a credential, because nothing logs in
     * with it any more.
     */
    private String uniqueUsername(String fullName) {
        String base = fullName.toLowerCase(Locale.ROOT)
                .replaceAll("[ăâ]", "a").replace('î', 'i').replace('ș', 's').replace('ț', 't')
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.isBlank()) {
            base = "user";
        }
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        String candidate = base;
        int suffix = 2;
        while (employeeRepository.findByUsername(candidate).isPresent()) {
            candidate = base + "_" + suffix++;
        }
        return candidate;
    }

    private boolean setupCodeMatches(String provided) {
        String expected = setupCode;
        String given = trimToNull(provided);
        if (expected == null || given == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                given.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    /** Crockford-ish alphabet: no O/0 or I/1 to misread off a terminal. */
    private String randomSetupCode() {
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(9);
        for (int i = 0; i < 8; i++) {
            if (i == 4) {
                sb.append('-');
            }
            sb.append(alphabet.charAt(secureRandom.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    private String randomVerificationCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private String randomSecret() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
