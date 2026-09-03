package com.example.damiProd.service;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.dto.SessionResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private static final String ADMIN_ROLE = "ADMIN";

    /**
     * The lockout guard's two refusals.
     *
     * Zero admins is unrecoverable, not merely inconvenient. With passwords and
     * Google sign-in gone there is no break-glass credential, and the only path
     * that mints an ADMIN without an existing one is the first-user bootstrap in
     * EnrollmentService - which fires on employeeRepository.count() == 0, i.e.
     * only against an EMPTY employee table. So the sole recovery from demoting
     * the last admin is deleting every employee in the database.
     *
     * The same rule lives in web/src/features/admin/EmployeesPage.tsx, which
     * disables the controls. That half is the friendly explanation; this half is
     * the one that actually holds, because it also covers a direct API call, a
     * script, or a future mobile admin screen.
     */
    static final String LAST_ADMIN_DEMOTE_MESSAGE =
            "Nu se poate retrage rolul de administrator: acesta este ultimul administrator. "
                    + "Promovează întâi pe altcineva.";
    static final String LAST_ADMIN_DELETE_MESSAGE =
            "Nu se poate șterge ultimul administrator. Promovează întâi pe altcineva.";

    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final TokenService tokenService;

    public AdminService(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            TokenService tokenService) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
        this.tokenService = tokenService;
    }

    /**
     * Get all employees
     */
    public List<EmployeeResponse> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(EmployeeResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get employee by ID
     */
    public Optional<EmployeeResponse> getEmployeeById(Long id) {
        return employeeRepository.findById(id)
                .map(EmployeeResponse::fromEntity);
    }

    /**
     * Create a new employee
     */
    @Transactional
    public EmployeeResponse createEmployee(CreateEmployeeRequest request) {
        // Check if username already exists
        if (employeeRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }

        // No password: nothing logs in with credentials any more. This creates
        // the PERSON (assignable to routes); their device gets access separately,
        // by enrolling and being approved - see EnrollmentService.
        Employee employee = new Employee();
        employee.setUsername(request.getUsername());
        employee.setFullName(request.getFullName());
        employee.setPhone(request.getPhone());
        employee.setCounty(request.getCounty());
        employee.setEmail(request.getEmail());

        // Save employee first
        Employee saved = employeeRepository.save(employee);

        // Add roles
        if (request.getRoleNames() != null && !request.getRoleNames().isEmpty()) {
            Set<EmployeeRole> roles = new HashSet<>();
            for (String roleName : request.getRoleNames()) {
                EmployeeRole role = employeeRoleRepository.findByRoleName(roleName.toUpperCase())
                        .orElseGet(() -> {
                            // Create role if it doesn't exist
                            EmployeeRole newRole = new EmployeeRole(roleName.toUpperCase());
                            return employeeRoleRepository.save(newRole);
                        });
                roles.add(role);
            }
            saved.setRoles(roles);
            saved = employeeRepository.save(saved);
        }

        return EmployeeResponse.fromEntity(saved);
    }

    /**
     * Update an existing employee. This is how someone is promoted to ADMIN or
     * demoted again.
     *
     * A ROLE change revokes every session that employee holds. The access token
     * is only checked for validity per request and authorities are read from the
     * Employee it points at, but revoking is still the right move: a demotion
     * must not leave the old device running on a session granted under the old
     * role, on any of up to 10 enrolled devices.
     *
     * Refuses with a 409 when the change would drop ADMIN from the last admin -
     * see {@link #LAST_ADMIN_DEMOTE_MESSAGE}. An update that does not carry
     * roleNames is not a demotion and is never blocked by it.
     */
    @Transactional
    public Optional<EmployeeResponse> updateEmployee(Long id, CreateEmployeeRequest request) {
        return employeeRepository.findById(id).map(employee -> {
            boolean credentialsChanged = false;

            // Update fields if provided
            if (request.getUsername() != null) {
                employee.setUsername(request.getUsername());
            }
            if (request.getFullName() != null) {
                employee.setFullName(request.getFullName());
            }
            if (request.getPhone() != null) {
                employee.setPhone(request.getPhone());
            }
            if (request.getCounty() != null) {
                employee.setCounty(request.getCounty());
            }
            if (request.getEmail() != null) {
                employee.setEmail(request.getEmail());
            }

            // Update roles if provided
            if (request.getRoleNames() != null && !request.getRoleNames().isEmpty()) {
                Set<EmployeeRole> roles = new HashSet<>();
                for (String roleName : request.getRoleNames()) {
                    EmployeeRole role = employeeRoleRepository.findByRoleName(roleName.toUpperCase())
                            .orElseGet(() -> {
                                EmployeeRole newRole = new EmployeeRole(roleName.toUpperCase());
                                return employeeRoleRepository.save(newRole);
                            });
                    roles.add(role);
                }
                // Checked BEFORE the roles are swapped in, because isLastAdmin
                // reads the employee's CURRENT roles to decide whether this is
                // the demotion that empties the admin set.
                if (!containsAdmin(roles) && isLastAdmin(employee)) {
                    throw new IllegalStateException(LAST_ADMIN_DEMOTE_MESSAGE);
                }
                if (!roles.equals(employee.getRoles())) {
                    credentialsChanged = true;
                }
                employee.setRoles(roles);
            }

            Employee saved = employeeRepository.save(employee);

            if (credentialsChanged) {
                int revoked = tokenService.revokeAllSessions(saved.getId(), "CREDENTIALS_CHANGED_BY_ADMIN");
                if (revoked > 0) {
                    log.info("Revoked {} session(s) for employee id={} after an admin credential change",
                            revoked, saved.getId());
                }
            }

            return EmployeeResponse.fromEntity(saved);
        });
    }

    /**
     * Delete an employee. Refused for the last remaining admin - see
     * {@link #LAST_ADMIN_DELETE_MESSAGE}.
     */
    @Transactional
    public boolean deleteEmployee(Long id) {
        Optional<Employee> found = employeeRepository.findById(id);
        if (found.isEmpty()) {
            return false;
        }
        if (isLastAdmin(found.get())) {
            throw new IllegalStateException(LAST_ADMIN_DELETE_MESSAGE);
        }
        employeeRepository.deleteById(id);
        return true;
    }

    /**
     * True when this employee is an ADMIN and no other employee is.
     *
     * Deliberately asks the database rather than counting a cached list: two
     * admins demoting each other concurrently would both read "2 admins" from a
     * stale snapshot and both succeed. This is not airtight either - there is no
     * optimistic locking anywhere in this app - but it narrows the window to the
     * transaction rather than the request.
     */
    private boolean isLastAdmin(Employee employee) {
        return containsAdmin(employee.getRoles())
                && employeeRepository.countByRoleName(ADMIN_ROLE) <= 1;
    }

    private static boolean containsAdmin(Set<EmployeeRole> roles) {
        return roles != null && roles.stream()
                .anyMatch(role -> ADMIN_ROLE.equalsIgnoreCase(role.getRoleName()));
    }

    // ==================== SESSIONS (TODO-56) ====================

    /**
     * The devices holding a live refresh token for one employee.
     *
     * Until this existed an admin could not revoke anyone else's session at all:
     * /api/auth/sessions is self-scoped, so a lost driver phone left only blunt
     * levers - change the person's role (which revokes as a SIDE EFFECT and also
     * changes what they may do), delete them, or wait out
     * {@code ecotrack.security.refresh-token-ttl-days}, which is a year.
     *
     * <p><b>The admin sees the same fields the owner sees</b> - device label,
     * created, last used - and that is the answer to "should an admin see
     * another employee's devices at all". Revoking blind is not a real option:
     * an employee may hold up to {@code ecotrack.security.max-sessions-per-user}
     * sessions, and picking the stolen phone out of ten identical rows needs the
     * label and the last-used time. There is no IP to leak either way; the app
     * has never stored one. What an admin gets is strictly a User-Agent string
     * and two timestamps, on an account they can already delete outright.
     *
     * <p>{@code callerSessionId} marks the "acest dispozitiv" row, so it is only
     * ever meaningful when an admin looks at their OWN id.
     */
    public List<SessionResponse> listSessions(Long employeeId, Long callerSessionId) {
        Employee employee = requireEmployee(employeeId);
        return tokenService.listActiveSessions(employee.getId()).stream()
                .map(session -> SessionResponse.fromEntity(session,
                        session.getId().equals(callerSessionId)))
                .collect(Collectors.toList());
    }

    /**
     * Revokes one of that employee's devices. False when the session does not
     * exist or belongs to somebody else - the employee id is the scoping check,
     * not decoration.
     */
    @Transactional
    public boolean revokeSession(Long employeeId, Long sessionId) {
        requireEmployee(employeeId);
        return tokenService.revokeSession(employeeId, sessionId, TokenService.REVOKED_BY_ADMIN);
    }

    /**
     * Revokes every device that employee has, and says how many.
     *
     * <p><b>Except the caller's own current session</b>, which only ever matters
     * when an admin runs this on themselves: signing yourself out mid-task is
     * never what the button meant, and for the LAST admin it would walk straight
     * into TODO-30's lockout. It is not a refusal - TODO-22 settled that an admin
     * who may not log out is worse than the lockout, and Deconectare and
     * {@code DELETE /api/admin/employees/{id}/sessions/{sessionId}} both still
     * end that session deliberately. This is the same "every device but this
     * one" rule {@code DELETE /api/auth/sessions} already has.
     */
    @Transactional
    public int revokeAllSessions(Long employeeId, Long callerSessionId) {
        requireEmployee(employeeId);
        int revoked = tokenService.revokeAllSessionsExcept(employeeId, callerSessionId,
                TokenService.REVOKED_BY_ADMIN);
        if (revoked > 0) {
            log.info("Admin revoked {} session(s) for employee id={}", revoked, employeeId);
        }
        return revoked;
    }

    /**
     * 404 rather than an empty list for an unknown id: "this person has no
     * devices" and "there is no such person" are different answers, and a typo
     * that reads as the first is how an admin concludes a lost phone is already
     * dead.
     */
    private Employee requireEmployee(Long employeeId) {
        return employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Angajatul nu a fost găsit"));
    }

    /**
     * Get all available roles
     */
    public List<String> getAllRoles() {
        return employeeRoleRepository.findAll().stream()
                .map(EmployeeRole::getRoleName)
                .collect(Collectors.toList());
    }

    /**
     * Create a new role
     */
    @Transactional
    public String createRole(String roleName) {
        String upperRoleName = roleName.toUpperCase();
        if (employeeRoleRepository.findByRoleName(upperRoleName).isPresent()) {
            throw new IllegalArgumentException("Role already exists: " + upperRoleName);
        }
        EmployeeRole role = new EmployeeRole(upperRoleName);
        return employeeRoleRepository.save(role).getRoleName();
    }
}
