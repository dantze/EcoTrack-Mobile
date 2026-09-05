package com.example.damiProd.SuiteTests;

import com.example.damiProd.repository.AccessRequestRepository;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test isolation is a property of the SUITE, so it is asserted here rather than
 * left to each class to get right (TODO-31).
 *
 * <p>The suite used to run every {@code @SpringBootTest} against one named
 * in-memory database - {@code jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1} in
 * application-test.properties. A named H2 mem database with that close delay
 * lives for the whole JVM, so it outlived every Spring context in the run and
 * all of them shared it.
 *
 * <p>That is fine for a class that is {@code @Transactional} - the test method
 * rolls back and leaves nothing. It is not fine for the five classes that
 * cannot be transactional, because they exercise the first-user bootstrap and
 * that path keys on COMMITTED state: EnrollmentFlowTest,
 * EnrollmentBootstrapCodeTest, ConfiguredSetupCodeTest,
 * ShortConfiguredSetupCodeTest and AdminLockoutRecoveryTest each committed an
 * ADMIN employee that outlived them. Any later class asserting something about
 * the whole table then read another class's leftovers, which is why
 * LastAdminGuardTest had to demote every pre-existing admin before it could say
 * anything about "the last admin", and why TODO-31 recorded that <em>any new
 * assertion about a global count is unsafe by default</em>.
 *
 * <p>The fix is one annotation, {@code @AutoConfigureTestDatabase}, on every
 * {@code @SpringBootTest}. It replaces the configured DataSource with an
 * auto-configured embedded one, and Spring Boot builds those with
 * {@code generateUniqueName(true)} - so the database name is unique per Spring
 * CONTEXT rather than shared per JVM. Contexts are still cached and reused, so
 * this costs no extra startups: classes whose configuration matches share a
 * context exactly as before, and now share that context's database with each
 * other and with nobody else.
 *
 * <p><strong>What this does not do:</strong> two classes with identical
 * configuration still share one context and therefore one database.
 * EnrollmentFlowTest and AdminLockoutRecoveryTest are that case - same
 * annotations, same one property. Both already clear the three tables they care
 * about in {@code @BeforeEach}, which is what makes their sharing safe; the
 * point of the isolation is that they can no longer reach anyone else.
 *
 * <p>{@code @DataJpaTest} classes were never part of the problem: that
 * annotation applies {@code @AutoConfigureTestDatabase} itself, and is
 * transactional besides.
 */
@SpringBootTest
@AutoConfigureTestDatabase
@ActiveProfiles("test")
// A property no other class sets, so this class gets a context - and therefore
// a database - of its own. That is what makes emptyAtStart() below a statement
// about isolation rather than about which class happened to run first.
@TestPropertySource(properties = "ecotrack.test.isolation-probe=true")
class DatabaseIsolationTest {

    /** Every {@code @SpringBootTest} in the suite must carry this. */
    private static final Class<AutoConfigureTestDatabase> REQUIRED = AutoConfigureTestDatabase.class;

    @Autowired private DataSource dataSource;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private EmployeeRoleRepository employeeRoleRepository;
    @Autowired private ProductRepository productRepository;

    /**
     * The behavioural half: this context's database has never been written to.
     *
     * <p>Five classes in this suite commit employees. Reading zero here means
     * none of them can reach this context - not that they happened to run
     * later, because JUnit gives no ordering guarantee either way.
     */
    @Test
    void aFreshContextGetsAFreshDatabase() {
        assertThat(employeeRepository.count())
                .as("employees committed by another test class are visible here")
                .isZero();
        assertThat(accessRequestRepository.count())
                .as("access requests committed by another test class are visible here")
                .isZero();
    }

    /**
     * The mechanical half: the DataSource really was replaced.
     *
     * <p>Without this, the assertion above would still pass on the day someone
     * removes the annotation and this class simply runs first - a green suite
     * that proves nothing. The shared URL is the thing that must be gone.
     */
    @Test
    void theSharedDatabaseIsNotInUse() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            String url = connection.getMetaData().getURL();
            assertThat(url)
                    .as("still on the suite-wide database from application-test.properties")
                    .doesNotContain("h2:mem:testdb");
        }
    }

    /**
     * The rule, applied to classes that do not exist yet.
     *
     * <p>A new {@code @SpringBootTest} that forgets the annotation silently
     * rejoins the shared database and re-opens exactly the bug TODO-31 was
     * about - silently, because it would still pass on its own. Scanning is
     * over the compiled test classes, so it sees whatever the suite actually
     * contains rather than a list someone has to remember to update.
     */
    @Test
    void everySpringBootTestIsolatesItsDatabase() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(SpringBootTest.class));

        List<String> offenders = new ArrayList<>();
        for (var candidate : scanner.findCandidateComponents("com.example.damiProd")) {
            String name = candidate.getBeanClassName();
            if (name == null) {
                continue;
            }
            try {
                Class<?> type = Class.forName(name);
                if (type.getAnnotation(REQUIRED) == null) {
                    offenders.add(type.getSimpleName());
                }
            } catch (ClassNotFoundException ignored) {
                // Not on this classpath; nothing to assert about it.
            }
        }

        assertThat(offenders)
                .as("@SpringBootTest classes missing @AutoConfigureTestDatabase — they would "
                        + "share one JVM-wide H2 database with the whole suite, and the classes "
                        + "that cannot be @Transactional commit employees into it (TODO-31)")
                .isEmpty();
    }

    /**
     * And nothing seeded it either (TODO-74).
     *
     * <p>Isolation says no other test class can reach this database. This says
     * the APPLICATION did not write to it before the first test ran, which is a
     * separate claim and was false until TODO-74: {@code DataLoader} is a
     * {@code CommandLineRunner}, {@code SpringBootContextLoader} runs those, and
     * so every {@code @SpringBootTest} context started with 4 role rows and 11
     * products in it. Unrequested state that every context paid for, and it made
     * a row count mean one thing here and another in a {@code @DataJpaTest},
     * which never registers the bean.
     *
     * <p>It is off via {@code ecotrack.bootstrap.seed-reference-data=false} in
     * application-test.properties. This assertion is what stops it coming back
     * unnoticed - and it belongs in this class rather than its own, because the
     * question is the same one: what is in a fresh {@code @SpringBootTest}
     * database. Tests that need a role find-or-create it, as production does.
     */
    @Test
    void aFreshContextIsNotSeeded() {
        assertThat(employeeRoleRepository.count())
                .as("DataLoader seeded roles into a test context — nothing asked it to (TODO-74)")
                .isZero();
        assertThat(productRepository.count())
                .as("DataLoader seeded the catalogue into a test context — nothing asked it to "
                        + "(TODO-74)")
                .isZero();
    }

    /** Sanity: the scan finds classes at all, so an empty result is a real pass. */
    @Test
    void theScanActuallySeesTheSuite() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(SpringBootTest.class));

        assertThat(scanner.findCandidateComponents("com.example.damiProd"))
                .as("no @SpringBootTest classes found — the guard above would pass vacuously")
                .isNotEmpty();
    }
}
