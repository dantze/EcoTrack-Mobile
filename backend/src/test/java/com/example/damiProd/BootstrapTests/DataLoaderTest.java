package com.example.damiProd.BootstrapTests;

import com.example.damiProd.bootstrap.DataLoader;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The seed used to create fifteen employees with committed plaintext-then-bcrypt
 * passwords. Both the employees and the passwords are gone: access now comes
 * only from an admin approving a device (see EnrollmentService), and the roles
 * are all the seed still needs to provide - an admin picks one when approving.
 */
@DataJpaTest
@Import(DataLoader.class)
class DataLoaderTest {

    @Autowired
    private DataLoader dataLoader;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmployeeRoleRepository employeeRoleRepository;

    @Test
    void seedsTheFourAssignableRoles() throws Exception {
        dataLoader.run();

        assertThat(employeeRoleRepository.findAll())
                .extracting(role -> role.getRoleName())
                .containsExactlyInAnyOrder("DRIVER", "SALES", "TECH", "ADMIN");
    }

    @Test
    void seedsNoEmployees() throws Exception {
        dataLoader.run();

        // Load-bearing, not incidental: the first-run bootstrap in
        // EnrollmentService triggers on an EMPTY employees table. A seeded row
        // would silently consume it and nobody could ever become the first admin.
        assertThat(employeeRepository.count()).isZero();
    }

    @Test
    void run_onAnAlreadySeededDatabase_doesNotReseed() throws Exception {
        dataLoader.run();
        long rolesAfterFirst = employeeRoleRepository.count();

        dataLoader.run();

        assertThat(employeeRoleRepository.count()).isEqualTo(rolesAfterFirst);
    }
}
