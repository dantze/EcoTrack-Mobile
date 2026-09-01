package com.example.damiProd.RepositoryTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Product;
import com.example.damiProd.domain.RidicareOrder;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.domain.TaskType;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.service.InsufficientQuantityException;
import com.example.damiProd.service.OrderService;
import com.example.damiProd.service.SubscriptionService;
import jakarta.persistence.Entity;
import jakarta.persistence.Version;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ============================================================================
 *  CHARACTERISATION TESTS FOR THE "Known gaps" SECTION OF CLAUDE.md.
 * ============================================================================
 *
 * These tests DEMONSTRATE BUGS. They assert the wrong-but-current behaviour on
 * purpose, so that the day someone fixes the underlying gap the test fails
 * loudly and can be inverted, rather than the fix landing unnoticed.
 *
 * Each one is tagged with the gap it pins:
 *   GAP 1 — no {@code @Version} optimistic locking on any entity, so concurrent
 *           edits are silent last-write-wins and the loser's *other* field
 *           changes are lost too (Spring Data {@code save()} issues a full-row
 *           UPDATE).
 *   GAP 2 — {@code OrderService.createOrder} is not {@code @Transactional} and
 *           its Ridicare availability check is a read-then-write race.
 *   GAP 3 — CLOSED (TODO-39). Subscription retirement was a check-then-act with
 *           nothing serialising it against order creation. The tests at the
 *           bottom now guard the fix rather than pinning the gap.
 *
 * Caveat that is itself part of the gap: this runs on H2 while production runs
 * Postgres ({@code ddl-auto=update}, no migration tool), so a *timing* test
 * here proves the logic is unguarded, not that the two engines interleave
 * identically. The assertions below therefore avoid depending on thread
 * scheduling: they reproduce the interleaving deterministically.
 */
@DataJpaTest
class ConcurrencyGapsTest {

    @Autowired private OrderRepository orderRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubscriptionRepository subscriptionRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private RecurringIgienizareRepository recurringIgienizareRepository;
    @Autowired private TestEntityManager em;

    private OrderService orderService;
    private SubscriptionService subscriptionService;
    private Company acme;
    private Product cabin;

    private static final String SITE = "44.43,26.10";
    private static final String CABIN = "Toaletă Standard";

    @BeforeEach
    void setUp() {
        // @DataJpaTest does not load @Service beans; wire the real service over
        // the real repositories so the test exercises production code paths.
        orderService = new OrderService(orderRepository, clientRepository, productRepository,
                subscriptionRepository, taskRepository, recurringIgienizareRepository);
        subscriptionService = new SubscriptionService(subscriptionRepository, orderRepository,
                recurringIgienizareRepository);

        acme = em.persist(new Company("office@acme.ro", "0311", "Bd. 20", "Acme SRL", "RO1", "Maria"));
        cabin = em.persist(new Product(CABIN, "Standard cabin", 500.0));
        em.flush();
    }

    private AmplasareOrder placement(int quantity) {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setDate(new Date());
        order.setClient(acme);
        order.setProduct(cabin);
        order.setLocationCoordinates(SITE);
        order.setQuantity(quantity);
        return em.persist(order);
    }

    private RidicareOrder pickupRequest(int quantity) {
        RidicareOrder rid = new RidicareOrder();
        rid.setOrderType("Ridicari");
        rid.setDate(new Date());
        rid.setPickupProductName(CABIN);
        rid.setPickupLocationCoordinates(SITE);
        rid.setPickupQuantity(quantity);
        return rid;
    }

    // =======================================================================
    // GAP 1 — no optimistic locking
    // =======================================================================

    @Test
    @DisplayName("GAP 1: no entity declares @Version, so nothing can detect a lost update")
    void noEntityDeclaresAVersionField() {
        List<Class<?>> entities = List.of(
                com.example.damiProd.domain.Order.class,
                com.example.damiProd.domain.AmplasareOrder.class,
                com.example.damiProd.domain.RidicareOrder.class,
                com.example.damiProd.domain.IgienizareOrder.class,
                com.example.damiProd.domain.Client.class,
                com.example.damiProd.domain.Individual.class,
                com.example.damiProd.domain.Company.class,
                com.example.damiProd.domain.Task.class,
                com.example.damiProd.domain.Route.class,
                com.example.damiProd.domain.Employee.class,
                com.example.damiProd.domain.Product.class,
                com.example.damiProd.domain.Subscription.class,
                com.example.damiProd.domain.RecurringIgienizare.class,
                com.example.damiProd.domain.Session.class);

        Set<String> versioned = entities.stream()
                .filter(type -> type.isAnnotationPresent(Entity.class))
                .filter(type -> Arrays.stream(type.getDeclaredFields())
                        .anyMatch(field -> field.isAnnotationPresent(Version.class)))
                .map(Class::getSimpleName)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());

        // ASSERTS THE GAP. When someone adds @Version to an entity this fails —
        // that is the signal to flip these characterisation tests into real
        // "concurrent edit is rejected" tests.
        assertThat(versioned)
                .as("entities with @Version — CLAUDE.md 'Known gaps': there are none, "
                        + "so concurrent edits are silent last-write-wins")
                .isEmpty();
    }

    @Test
    @DisplayName("GAP 1: a concurrent edit silently discards the loser's UNRELATED field changes")
    void lastWriteWins_alsoLosesFieldsTheSecondWriterNeverTouched() {
        Task task = new Task();
        task.setType(TaskType.PLACEMENT);
        task.setStatus(TaskStatus.NEW);
        task.setInternalNotes("original notes");
        task.setContactPerson("Ion");
        Task persisted = taskRepository.save(task);
        em.flush();
        em.clear();

        // Two users open the same task. Both loaded the SAME starting state.
        Task dispatcherCopy = taskRepository.findById(persisted.getId()).orElseThrow();
        em.detach(dispatcherCopy);
        Task driverCopy = taskRepository.findById(persisted.getId()).orElseThrow();
        em.detach(driverCopy);

        // The dispatcher edits the notes and saves.
        dispatcherCopy.setInternalNotes("dispatcher: call the site manager first");
        taskRepository.save(dispatcherCopy);
        em.flush();
        em.clear();

        // The driver, still holding the stale copy, only marks it completed.
        driverCopy.setStatus(TaskStatus.COMPLETED);
        taskRepository.save(driverCopy);
        em.flush();
        em.clear();

        Task reloaded = taskRepository.findById(persisted.getId()).orElseThrow();

        assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.COMPLETED);
        // ASSERTS THE BUG: the driver never touched internalNotes, but save()
        // issued a full-row UPDATE from a stale snapshot, so the dispatcher's
        // note is gone with no error anywhere.
        assertThat(reloaded.getInternalNotes())
                .as("the dispatcher's note was silently reverted by an unrelated edit")
                .isEqualTo("original notes");
    }

    // =======================================================================
    // GAP 2 — read-then-write race in the Ridicare availability check
    // =======================================================================

    @Test
    @DisplayName("GAP 2: the availability check does reject an over-claim when requests are serialised")
    void availabilityCheck_rejectsAnOverClaim_whenNothingInterleaves() {
        placement(5);
        em.flush();
        em.clear();

        assertThatThrownBy(() -> orderService.createOrder(acme.getId(), pickupRequest(6)))
                .isInstanceOf(InsufficientQuantityException.class)
                .hasMessageContaining("Disponibil: 5")
                .hasMessageContaining("solicitat: 6");

        assertThat(orderRepository.findByClientId(acme.getId()))
                .noneMatch(RidicareOrder.class::isInstance);
    }

    @Test
    @DisplayName("GAP 2: two pickups that each pass the check can jointly over-claim the site")
    void readThenWriteRace_twoConcurrentPickupsBothPassAndOverdrawTheSite() {
        placement(5);
        em.flush();
        em.clear();

        // Deterministic reproduction of the interleaving. createOrder() is NOT
        // @Transactional and holds no lock, so its sequence is:
        //     SUM(placed) -> SUM(claimed) -> compare -> save
        // Request A completes that sequence...
        Order first = orderService.createOrder(acme.getId(), pickupRequest(3));
        em.flush();

        // ...and request B, which had already read "available = 5" before A's
        // save landed, now proceeds straight to its own save. Nothing re-checks.
        RidicareOrder secondRequest = pickupRequest(4);
        secondRequest.setClient(clientRepository.findById(acme.getId()).orElseThrow());
        Order second = orderRepository.save(secondRequest);
        em.flush();
        em.clear();

        assertThat(first.getId()).isNotNull();
        assertThat(second.getId()).isNotNull();

        int placed = orderRepository
                .sumAmplasareQuantityByClientLocationAndProduct(acme.getId(), SITE, CABIN);
        int claimed = orderRepository
                .sumRidicareQuantityByClientLocationAndProduct(acme.getId(), SITE, CABIN);

        // ASSERTS THE BUG: 7 cabins are promised for pickup at a site that only
        // ever had 5 placed. Availability is now negative and every subsequent
        // legitimate pickup at this site is refused.
        assertThat(claimed).as("total claimed for pickup").isEqualTo(7);
        assertThat(placed - claimed)
                .as("available quantity went negative — CLAUDE.md 'Known gaps': "
                        + "OrderService.createOrder is not @Transactional and the "
                        + "availability check is a read-then-write race")
                .isEqualTo(-2);
    }

    @Test
    @DisplayName("GAP 2: the check is skipped entirely when any of its three inputs is null")
    void availabilityCheck_isSkippedWhenPickupFieldsAreIncomplete() {
        placement(1);
        em.flush();
        em.clear();

        // No coordinates -> the whole `if` is skipped, so a 999-unit pickup at
        // an unspecified location is created without complaint.
        RidicareOrder noCoords = pickupRequest(999);
        noCoords.setPickupLocationCoordinates(null);

        Order created = orderService.createOrder(acme.getId(), noCoords);

        assertThat(created).isInstanceOf(RidicareOrder.class);
        assertThat(created.getId()).isNotNull();
    }

    @Test
    @DisplayName("GAP 2 (CLOSED): createOrder is @Transactional, so a failure mid-way rolls back as a unit")
    void createOrderIsAnnotatedTransactional() throws NoSuchMethodException {
        var method = OrderService.class.getMethod("createOrder", Long.class, Order.class);

        boolean transactional =
                method.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)
                        || OrderService.class.isAnnotationPresent(
                                org.springframework.transaction.annotation.Transactional.class);

        // This used to assert the GAP - that createOrder was NOT transactional -
        // as a deliberate tripwire, so that whoever fixed it would be forced back
        // here. It has since been fixed, so the assertion is inverted and now
        // guards the fix instead: removing @Transactional must fail loudly.
        assertThat(transactional)
                .as("OrderService.createOrder must stay @Transactional - multi-step "
                        + "creation and inventory adjustment have to roll back as one unit")
                .isTrue();
    }

    // =======================================================================
    // GAP 3 (CLOSED) - subscription retirement vs. order creation (TODO-39)
    // =======================================================================
    //
    // deactivate() read its blockers and then wrote isActive = false. Nothing
    // made that atomic: POST /api/orders could commit a live IgienizareOrder in
    // between, and since that transaction touched no row the retirement had
    // looked at, there was nothing to conflict on - no @Version, no lock, no
    // constraint. Both sides now take SELECT ... FOR UPDATE on the same
    // subscription row and re-read under it.
    //
    // These run against the real repositories on H2, which is the point: the
    // locking query has to be valid on the engine dev and test actually use,
    // not only on the Postgres that prod runs. They do NOT race threads - the
    // interleavings below are reproduced deterministically, exactly like the
    // GAP 2 tests above, so nothing here depends on scheduling.

    private Subscription plan(boolean active) {
        Subscription sub = new Subscription();
        sub.setName("Igienizare lunară");
        sub.setIsActive(active);
        return em.persist(sub);
    }

    private IgienizareOrder sanitationOrderOn(Subscription plan) {
        IgienizareOrder order = new IgienizareOrder();
        order.setOrderType("Igienizari");
        order.setDate(new Date());
        order.setClient(acme);
        order.setSubscription(plan);
        order.setSanitationDate("2026-09-14");
        return order;
    }

    @Test
    @DisplayName("GAP 3: the FOR UPDATE read of a subscription is valid SQL on H2, not only on Postgres")
    void subscriptionRowLock_executesOnH2() {
        Subscription sub = plan(true);
        em.flush();

        // Dev and test run H2 while prod runs Postgres and there is no migration
        // tool, so a locking query that only compiles on one engine would be a
        // fix that never runs anywhere it is tested.
        assertThat(subscriptionRepository.findByIdForUpdate(sub.getId()))
                .as("SELECT ... FOR UPDATE on the subscriptions row")
                .contains(sub);
    }

    @Test
    @DisplayName("GAP 3: a plan cannot retire while an order created through OrderService is still live")
    void retirement_seesAnOrderThatCommittedFirst() {
        Subscription sub = plan(true);
        em.flush();

        // Interleaving A: the order wins the lock and commits first.
        orderService.createOrder(acme.getId(), sanitationOrderOn(sub));
        em.flush();

        // The retirement then takes the lock, re-reads the blockers and refuses.
        assertThatThrownBy(() -> subscriptionService.deactivate(sub.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Nu se poate șterge abonamentul")
                .hasMessageContaining("1 comandă nefinalizată");

        assertThat(subscriptionRepository.findById(sub.getId()).orElseThrow().getIsActive())
                .as("the plan stays open while live work points at it")
                .isTrue();
    }

    @Test
    @DisplayName("GAP 3: an order cannot be created on a plan that retired first")
    void orderCreation_seesARetirementThatCommittedFirst() {
        Subscription sub = plan(true);
        em.flush();

        // Interleaving B, the one the lock alone would not have fixed: the
        // retirement wins. Serialising the two only decides who goes second -
        // the re-read under the lock is what makes the loser refuse instead of
        // committing a live order onto a plan that no longer accepts any.
        subscriptionService.deactivate(sub.getId());
        em.flush();

        assertThatThrownBy(() -> orderService.createOrder(acme.getId(), sanitationOrderOn(sub)))
                .isInstanceOf(IllegalStateException.class)  // -> 409; the plan exists, it is retired
                .hasMessageContaining("dezactivat");

        assertThat(orderRepository.findLiveBySubscriptionId(sub.getId()))
                .as("no live order was left on the retired plan")
                .isEmpty();
    }

    @Test
    @DisplayName("GAP 3: a finished order on a retired plan can still be edited")
    void updatingAnOrderAlreadyOnARetiredPlanIsNotBlocked() {
        // The delete is soft precisely so orders already carried out keep
        // resolving through the surviving row. Re-sending the plan an order is
        // already on must therefore stay legal - only a MOVE onto a retired plan
        // is refused.
        Subscription sub = plan(false);
        em.flush();

        IgienizareOrder existing = em.persist(sanitationOrderOn(sub));
        em.flush();

        IgienizareOrder updates = new IgienizareOrder();
        updates.setOrderType("Igienizari");
        updates.setSubscription(sub);
        updates.setSanitationLocationAddress("Str. Nouă 7");

        Order updated = orderService.updateOrder(existing.getId(), updates);

        assertThat(((IgienizareOrder) updated).getSanitationLocationAddress()).isEqualTo("Str. Nouă 7");
        assertThat(((IgienizareOrder) updated).getSubscription().getId()).isEqualTo(sub.getId());
    }
}
