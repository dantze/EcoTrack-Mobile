package com.example.damiProd.RepositoryTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Product;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.SubscriptionType;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.service.TaskService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The fulfilment rule, driven from the shared fixture (TODO-41).
 *
 * <p>"Is this order's work finished?" is answered in three places that share no
 * code and cannot import each other:
 *
 * <ul>
 *   <li>{@code OrderRepository.findLiveBySubscriptionId} — JPQL, refuses to
 *       retire a subscription while an unfinished order points at it</li>
 *   <li>{@code OrderRepository.countLiveByProductId} and its listed twin
 *       {@code findLiveByProductId} — the same refusal for a product, and the
 *       dialog that explains it (TODO-57). Two queries, one predicate: they are
 *       run against every case here so the dialog can never name a different set
 *       of orders from the one the refusal counted</li>
 *   <li>{@link TaskService#summariseOrderTasks} — what
 *       {@code GET /api/tasks/order/{id}/exists} reports</li>
 *   <li>{@code isOrderFulfilled} in the web app — the Curente / Arhivă split</li>
 * </ul>
 *
 * <p>TODO-40's {@code doc_claims.py} pins that they keep NAMING each other.
 * {@code shared/fulfilment-cases.json} is what pins that they still AGREE, and
 * {@code web/src/features/sales/__tests__/fulfilment.test.ts} reads the very
 * same file. Adding a case there fails whichever side does not follow.
 *
 * <p>This runs against a real (embedded H2) schema on purpose. The JPQL is the
 * half that a mock cannot check — before this class,
 * {@code findLiveBySubscriptionId} was only ever stubbed in
 * {@code SubscriptionServiceTest} and never once executed.
 */
@DataJpaTest
class FulfilmentRuleTest {

    /** Repo-root-relative, from the Gradle working directory (backend/). */
    private static final Path FIXTURE = Path.of("..", "shared", "fulfilment-cases.json");

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager em;

    private Company acme;

    @BeforeEach
    void seed() {
        acme = em.persist(new Company("office@acme.ro", "0311", "Bd. Firmei 20",
                "Acme SRL", "RO12345678", "Maria"));
        em.flush();
    }

    @TestFactory
    List<DynamicTest> everyGoldenCase() throws IOException {
        JsonNode fixture = new ObjectMapper().readTree(Files.readString(FIXTURE));
        List<DynamicTest> tests = new ArrayList<>();
        for (JsonNode testCase : fixture.get("cases")) {
            tests.add(DynamicTest.dynamicTest(testCase.get("name").asText(),
                    () -> assertCase(testCase)));
        }
        assertThat(tests).isNotEmpty();
        return tests;
    }

    private void assertCase(JsonNode testCase) {
        List<TaskStatus> statuses = new ArrayList<>();
        for (JsonNode status : testCase.get("taskStatuses")) {
            statuses.add(TaskStatus.valueOf(status.asText()));
        }

        // A plan of its own per case: these run in one shared transaction, so a
        // shared subscription would let one case's orders answer another's. The
        // product below is per-case for the same reason.
        Subscription plan = em.persist(subscription());
        IgienizareOrder order = em.persist(order(plan));
        Product product = em.persist(product());
        AmplasareOrder placement = em.persist(placement(product));
        List<Task> tasks = new ArrayList<>();
        for (TaskStatus status : statuses) {
            tasks.add(em.persist(task(order, TaskType.SANITIZATION, status)));
            // The placement gets the SAME statuses, so the product rule is
            // driven by the same case rather than by a second fixture.
            em.persist(task(placement, TaskType.PLACEMENT, status));
        }
        em.flush();

        // 1. The endpoint's roll-up.
        Optional<Task> summary = TaskService.summariseOrderTasks(tasks);
        JsonNode expectedStatus = testCase.get("summarisedStatus");
        if (expectedStatus.isNull()) {
            assertThat(summary).as("summarised status of an order with no tasks").isEmpty();
        } else {
            assertThat(summary).isPresent();
            assertThat(summary.get().getStatus().name())
                    .as("summarised status reported by /tasks/order/{id}/exists")
                    .isEqualTo(expectedStatus.asText());
        }

        // 2. The guard, as JPQL against a real schema. "Live" is the negation of
        //    fulfilled: a finished order no longer holds its subscription open.
        boolean fulfilled = testCase.get("fulfilled").asBoolean();
        assertThat(orderRepository.findLiveBySubscriptionId(plan.getId()))
                .as("findLiveBySubscriptionId must %s this order",
                        fulfilled ? "release" : "still block on")
                .extracting(IgienizareOrder::getId)
                .containsExactlyElementsOf(fulfilled ? List.of() : List.of(order.getId()));

        // 3. The product half of the same rule (TODO-38), and its listed form
        //    (TODO-57). The count is what refuses a product delete; the list is
        //    what the dialog names. They must agree with each other AND with the
        //    subscription answer above, or a refusal counting three orders opens
        //    a dialog showing two.
        assertThat(orderRepository.countLiveByProductId(product.getId()))
                .as("countLiveByProductId must %s this placement",
                        fulfilled ? "release" : "still block on")
                .isEqualTo(fulfilled ? 0 : 1);
        assertThat(orderRepository.findLiveByProductId(product.getId()))
                .as("findLiveByProductId lists exactly what countLiveByProductId counts")
                .extracting(Order::getId)
                .containsExactlyElementsOf(fulfilled ? List.of() : List.of(placement.getId()));

        // 4. The two must say the same thing about the same order — which is the
        //    whole point of the fixture, and what drifted in TODO-34.
        boolean fulfilledPerSummary = summary
                .map(task -> task.getStatus() == TaskStatus.COMPLETED)
                .orElse(false);
        assertThat(fulfilledPerSummary)
                .as("the endpoint and the guard must agree about this order")
                .isEqualTo(fulfilled);
    }

    private Subscription subscription() {
        Subscription plan = new Subscription();
        plan.setName("Igienizare lunară");
        plan.setType(SubscriptionType.RECURRING);
        plan.setPrice(250.0);
        plan.setVisitsPerMonth(1);
        plan.setIsIndefinite(true);
        return plan;
    }

    private Product product() {
        return new Product("Toaletă Standard", "Standard", 450.0);
    }

    /**
     * The product side's equivalent of {@link #order}: an Amplasare carrying the
     * product, so the same case exercises both deletion guards.
     */
    private AmplasareOrder placement(Product product) {
        AmplasareOrder placement = new AmplasareOrder();
        placement.setOrderType("Amplasari");
        placement.setDate(new Date());
        placement.setClient(acme);
        placement.setProduct(product);
        placement.setQuantity(2);
        placement.setStartDate("2026-03-04");
        return placement;
    }

    private IgienizareOrder order(Subscription plan) {
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setDate(new Date());
        order.setClient(acme);
        order.setSubscription(plan);
        order.setSanitationDate("2026-03-04");
        return order;
    }

    /**
     * Scheduled time is left null on every task, deliberately: the fixture's
     * expected summary must follow from the statuses alone, never from a date.
     */
    private Task task(Order order, TaskType type, TaskStatus status) {
        Task task = new Task(type, null, "Str. Exemplu 5, Cluj", "Acme SRL");
        task.setStatus(status);
        task.setOrder(order);
        return task;
    }
}
