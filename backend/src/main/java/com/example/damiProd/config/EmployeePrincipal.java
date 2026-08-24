package com.example.damiProd.config;

import com.example.damiProd.domain.Employee;

/**
 * The Spring Security principal set by {@link BearerTokenAuthenticationFilter}
 * once an access token has been validated. Carries the employee plus which
 * session the request came in on (needed for "is this the current device"
 * checks and for logout-all-other-devices).
 */
public class EmployeePrincipal {

    private final Employee employee;
    private final Long sessionId;

    public EmployeePrincipal(Employee employee, Long sessionId) {
        this.employee = employee;
        this.sessionId = sessionId;
    }

    public Employee getEmployee() {
        return employee;
    }

    public Long getSessionId() {
        return sessionId;
    }
}
