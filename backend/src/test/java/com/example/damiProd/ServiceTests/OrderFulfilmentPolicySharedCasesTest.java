package com.example.damiProd.ServiceTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.RidicareOrder;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.service.OrderFulfilmentPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * The backend half of the shared order-lifecycle contract.
 *
 * {@link OrderFulfilmentPolicy} and {@code web/src/lib/orderLifecycle.ts} are a
 * deliberate mirror pair with NO reference between them — one is Java, one is
 * TypeScript, and neither toolchain can see the other. This test and its web
 * twin (`orderLifecycleSharedCases.test.ts`) both read
 * {@code shared/order-lifecycle-cases.json}, so a rule change that lands in
 * only one implementation fails the other's build.
 *
 * Sibling {@code OrderFulfilmentPolicyTest} keeps the hand-written cases that
 * document intent in prose. This one exists purely to be un-driftable: adding a
 * case there proves nothing about the web app, adding one to the shared file
 * proves it on both sides.
 */
class OrderFulfilmentPolicySharedCasesTest {

    private static final String FIXTURE = "shared/order-lifecycle-cases.json";

    private final OrderFulfilmentPolicy policy = new OrderFulfilmentPolicy();

    @TestFactory
    List<DynamicTest> sharedCases() throws IOException {
        JsonNode root = new ObjectMapper().readTree(Files.newBufferedReader(locateFixture()));
        LocalDate globalToday = LocalDate.parse(root.get("today").asText());

        List<DynamicTest> tests = new ArrayList<>();
        collect(tests, root.get("cases"), globalToday, "shared");
        collect(tests, root.get("backendOnlyCases"), globalToday, "backend-only");

        // A fixture that silently stopped being read would make this suite pass
        // while guarding nothing, which is the one failure mode a green test
        // cannot report on its own.
        assertThat(tests).as("cases loaded from " + FIXTURE).isNotEmpty();
        return tests;
    }

    private void collect(List<DynamicTest> tests, JsonNode cases, LocalDate globalToday, String kind) {
        if (cases == null) return;
        for (JsonNode testCase : cases) {
            String name = testCase.get("name").asText();
            LocalDate today = testCase.has("today")
                    ? LocalDate.parse(testCase.get("today").asText())
                    : globalToday;
            Order order = buildOrder(testCase.get("order"));
            List<Task> tasks = buildTasks(testCase.get("tasks"));
            boolean expected = testCase.get("fulfilled").asBoolean();

            tests.add(DynamicTest.dynamicTest("[" + kind + "] " + name, () ->
                    assertThat(policy.isFulfilled(order, tasks, today))
                            .as("%s — if the web suite disagrees, the mirror pair has drifted", name)
                            .isEqualTo(expected)));
        }
    }

    private Order buildOrder(JsonNode node) {
        String type = node.get("orderType").asText();
        switch (type) {
            case "Amplasari" -> {
                AmplasareOrder order = new AmplasareOrder();
                order.setOrderType(type);
                order.setStartDate(text(node, "startDate"));
                order.setEndDate(text(node, "endDate"));
                if (node.hasNonNull("isIndefinite")) {
                    order.setIsIndefinite(node.get("isIndefinite").asBoolean());
                }
                return order;
            }
            case "Ridicari" -> {
                RidicareOrder order = new RidicareOrder();
                order.setOrderType(type);
                order.setPickupDate(text(node, "pickupDate"));
                return order;
            }
            case "Igienizari" -> {
                IgienizareOrder order = new IgienizareOrder();
                order.setOrderType(type);
                order.setSanitationDate(text(node, "sanitationDate"));
                return order;
            }
            default -> {
                // A new order subtype reaches this branch before anyone has
                // decided whether it has a window or an instant — see the
                // `order-type` skill. Failing here is the intended outcome.
                return fail("unknown orderType in " + FIXTURE + ": " + type);
            }
        }
    }

    private List<Task> buildTasks(JsonNode node) {
        List<Task> tasks = new ArrayList<>();
        if (node == null) return tasks;
        for (JsonNode status : node) {
            Task task = new Task();
            task.setStatus(TaskStatus.valueOf(status.asText()));
            tasks.add(task);
        }
        return tasks;
    }

    private String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    /**
     * Gradle runs tests with the working directory set to {@code backend/}, but
     * an IDE may use the repo root. Walk up rather than hardcode either, so the
     * fixture is found the same way from both.
     */
    private Path locateFixture() {
        Path dir = Paths.get("").toAbsolutePath();
        for (int depth = 0; dir != null && depth < 5; depth++, dir = dir.getParent()) {
            Path candidate = dir.resolve(FIXTURE);
            if (Files.isReadable(candidate)) return candidate;
        }
        return fail("could not find " + FIXTURE + " walking up from " + Paths.get("").toAbsolutePath()
                + " — the shared contract is missing, not merely failing");
    }
}
