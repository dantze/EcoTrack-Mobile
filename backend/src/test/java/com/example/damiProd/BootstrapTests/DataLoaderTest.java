package com.example.damiProd.BootstrapTests;

import com.example.damiProd.bootstrap.DataLoader;
import com.example.damiProd.domain.Employee;
import com.example.damiProd.repository.EmployeeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The seed used to call setPassword() with the raw value, so a freshly
 * provisioned database held every staff password in plaintext until each
 * person happened to log in and trip AuthService's legacy-plaintext migration.
 */
@DataJpaTest
@Import({ DataLoader.class, DataLoaderTest.EncoderConfig.class })
class DataLoaderTest {

    @TestConfiguration
    static class EncoderConfig {
        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder(4);
        }
    }

    @Autowired
    private DataLoader dataLoader;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void seededEmployees_areStoredAsBcryptHashes() throws Exception {
        dataLoader.run();

        List<Employee> seeded = employeeRepository.findAll();
        assertThat(seeded).isNotEmpty();
        assertThat(seeded).allSatisfy(employee -> assertThat(employee.getPassword())
                .as("seeded password for %s", employee.getUsername())
                .startsWith("$2"));
    }

    @Test
    void seededAdmin_canStillLogInWithTheDocumentedPassword() throws Exception {
        dataLoader.run();

        // Hashing the seed must not change what the credentials *are* - local dev
        // and the deploy runbook both rely on these values.
        Employee admin = employeeRepository.findByUsername("admin").orElseThrow();
        assertThat(passwordEncoder.matches("admin", admin.getPassword())).isTrue();

        Employee driver = employeeRepository.findByUsername("coman_teofil").orElseThrow();
        assertThat(passwordEncoder.matches("sofer23423", driver.getPassword())).isTrue();
    }

    @Test
    void run_onAnAlreadySeededDatabase_doesNotReseed() throws Exception {
        dataLoader.run();
        long afterFirst = employeeRepository.count();

        dataLoader.run();

        assertThat(employeeRepository.count()).isEqualTo(afterFirst);
    }
}
