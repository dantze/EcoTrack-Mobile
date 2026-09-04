package com.example.damiProd.RepositoryTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Order;
import com.example.damiProd.repository.OrderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The backfill that gives a number to orders written before orders had numbers
 * (TODO-70).
 *
 * <p>Every order created before TODO-69 was persisted with {@code number = 0},
 * because the field is a primitive {@code long} and nothing assigned it. Those
 * rows all render as "#0" and make {@code ORDER BY o.number} meaningless.
 *
 * <p>Two properties are worth pinning, and the second is the one that makes it
 * safe to run at every boot:
 *
 * <ol>
 *   <li>a zero becomes the row's own id — the SAME rule {@code OrderService}
 *       applies to new orders, so old and new rows end up in one number space;
 *   <li>a row that already has a number is never touched, so a second run is a
 *       no-op and re-running cannot renumber anything.
 * </ol>
 */
@DataJpaTest
class OrderNumberBackfillTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    /**
     * Persists an order the way a pre-TODO-69 build did: through the repository
     * directly, so nothing assigns {@code number} and it keeps its primitive
     * default of 0. Going through OrderService would number it and there would
     * be nothing to test.
     */
    private Order legacyOrder(String clientName) {
        Company client = new Company();
        client.setName(clientName);
        client.setEmail(clientName.toLowerCase() + "@example.ro");
        client.setPhone("+40700000000");
        client.setAddress("Str. Exemplu 1");
        entityManager.persist(client);

        AmplasareOrder order = new AmplasareOrder();
        order.setClient(client);
        order.setDate(new Date());
        return orderRepository.save(order);
    }

    @Test
    @DisplayName("an order saved without a number keeps 0 until the backfill runs")
    void legacyOrdersStartAtZero() {
        Order order = legacyOrder("Alfa");
        entityManager.flush();

        // The premise of TODO-70. If this ever fails, the backfill has nothing
        // left to fix and can go.
        assertThat(order.getNumber()).isZero();
    }

    @Test
    @DisplayName("backfill gives every zero-numbered order its own id as its number")
    void backfillNumbersFromId() {
        Order first = legacyOrder("Beta");
        Order second = legacyOrder("Gamma");
        entityManager.flush();

        int fixed = orderRepository.backfillMissingOrderNumbers();
        entityManager.clear();

        assertThat(fixed).isEqualTo(2);

        List<Order> after = orderRepository.findAll();
        assertThat(after)
                .as("every order now carries its own id as its number")
                .allSatisfy(order -> assertThat(order.getNumber()).isEqualTo(order.getId()));
        assertThat(after).extracting(Order::getNumber)
                .containsExactlyInAnyOrder(first.getId(), second.getId());
    }

    @Test
    @DisplayName("backfill leaves an order that already has a number alone")
    void backfillDoesNotRenumber() {
        Order numbered = legacyOrder("Delta");
        numbered.setNumber(4242);
        orderRepository.save(numbered);
        entityManager.flush();

        int fixed = orderRepository.backfillMissingOrderNumbers();
        entityManager.clear();

        assertThat(fixed).as("nothing was zero, so nothing was updated").isZero();
        assertThat(orderRepository.findById(numbered.getId()))
                .get()
                .extracting(Order::getNumber)
                .isEqualTo(4242L);
    }

    @Test
    @DisplayName("running the backfill twice changes nothing the second time")
    void backfillIsIdempotent() {
        legacyOrder("Epsilon");
        entityManager.flush();

        assertThat(orderRepository.backfillMissingOrderNumbers()).isEqualTo(1);
        entityManager.clear();

        // This is what lets it run on every boot instead of being a one-off
        // statement somebody has to remember to apply per environment.
        assertThat(orderRepository.backfillMissingOrderNumbers()).isZero();
        entityManager.clear();

        assertThat(orderRepository.countByNumber(0L))
                .as("no order is left at #0")
                .isZero();
    }

    @Test
    @DisplayName("a mixed table gets the zeroes fixed and the rest untouched")
    void backfillOnlyTouchesZeroes() {
        Order legacy = legacyOrder("Zeta");
        Order alreadyNumbered = legacyOrder("Eta");
        alreadyNumbered.setNumber(9001);
        orderRepository.save(alreadyNumbered);
        entityManager.flush();

        assertThat(orderRepository.backfillMissingOrderNumbers()).isEqualTo(1);
        entityManager.clear();

        assertThat(orderRepository.findById(legacy.getId()))
                .get().extracting(Order::getNumber).isEqualTo(legacy.getId());
        assertThat(orderRepository.findById(alreadyNumbered.getId()))
                .get().extracting(Order::getNumber).isEqualTo(9001L);
    }
}
