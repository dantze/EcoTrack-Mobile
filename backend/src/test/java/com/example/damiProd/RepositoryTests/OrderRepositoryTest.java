package com.example.damiProd.RepositoryTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Product;
import com.example.damiProd.domain.RidicareOrder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises {@link com.example.damiProd.repository.OrderRepository} against a
 * real (embedded H2) schema.
 *
 * Two things here are only observable with a real database:
 *   1. The JOINED inheritance mapping — polymorphic finders must return the
 *      concrete subclass, and the subtype-scoped JPQL ("FROM AmplasareOrder o")
 *      must not see rows of the sibling subtypes.
 *   2. The Ridicare availability SUM queries, whose COALESCE, per-location and
 *      per-product-NAME (not per-product-id) filtering are all easy to break
 *      with a mocked repository and impossible to notice.
 */
@DataJpaTest
class OrderRepositoryTest {

    @Autowired
    private com.example.damiProd.repository.OrderRepository orderRepository;

    @Autowired
    private TestEntityManager em;

    private static final String SITE_A = "44.43,26.10";
    private static final String SITE_B = "45.75,21.22";
    private static final String CABIN = "Toaletă Standard";
    private static final String SHOWER = "Duș Mobil";

    private Company acme;
    private Individual ion;
    private Product cabin;
    private Product shower;

    @BeforeEach
    void seed() {
        acme = em.persist(new Company("office@acme.ro", "0311", "Bd. Firmei 20",
                "Acme SRL", "RO12345678", "Maria"));
        ion = em.persist(new Individual("ion@example.ro", "0722", "Str. 4",
                "Ion Popescu", "1900101123456"));
        cabin = em.persist(new Product(CABIN, "Standard cabin", 500.0));
        shower = em.persist(new Product(SHOWER, "Mobile shower", 900.0));
        em.flush();
    }

    private AmplasareOrder placement(Client client, Product product, String coords, int quantity) {
        AmplasareOrder order = new AmplasareOrder();
        order.setOrderType("Amplasari");
        order.setDate(new Date());
        order.setClient(client);
        order.setProduct(product);
        order.setLocationCoordinates(coords);
        order.setQuantity(quantity);
        return em.persist(order);
    }

    private RidicareOrder pickup(Client client, String productName, String coords, int quantity) {
        RidicareOrder order = new RidicareOrder();
        order.setOrderType("Ridicari");
        order.setDate(new Date());
        order.setClient(client);
        order.setPickupProductName(productName);
        order.setPickupLocationCoordinates(coords);
        order.setPickupQuantity(quantity);
        return em.persist(order);
    }

    // -----------------------------------------------------------------------
    // JOINED inheritance
    // -----------------------------------------------------------------------

    @Test
    void findByClientId_returnsEveryOrderSubtypeAsItsConcreteClass() {
        placement(acme, cabin, SITE_A, 3);
        pickup(acme, CABIN, SITE_A, 1);

        IgienizareOrder igi = new IgienizareOrder();
        igi.setOrderType("Igienizari");
        igi.setDate(new Date());
        igi.setClient(acme);
        igi.setSanitationLocationCoordinates(SITE_A);
        em.persist(igi);
        em.flush();
        em.clear();

        List<Order> orders = orderRepository.findByClientId(acme.getId());

        assertThat(orders).hasSize(3);
        assertThat(orders).hasAtLeastOneElementOfType(AmplasareOrder.class);
        assertThat(orders).hasAtLeastOneElementOfType(RidicareOrder.class);
        assertThat(orders).hasAtLeastOneElementOfType(IgienizareOrder.class);
        assertThat(orders).extracting(Order::getOrderType)
                .containsExactlyInAnyOrder("Amplasari", "Ridicari", "Igienizari");
    }

    @Test
    void findByClientId_isScopedToOneClient() {
        placement(acme, cabin, SITE_A, 3);
        placement(ion, cabin, SITE_A, 5);
        em.flush();
        em.clear();

        assertThat(orderRepository.findByClientId(ion.getId()))
                .singleElement()
                .isInstanceOfSatisfying(AmplasareOrder.class,
                        amp -> assertThat(amp.getQuantity()).isEqualTo(5));
    }

    @Test
    void findAllWithClientAndProduct_joinFetchesTheClientSubclass() {
        placement(acme, cabin, SITE_A, 2);
        placement(ion, shower, SITE_B, 1);
        em.flush();
        em.clear();

        List<Order> orders = orderRepository.findAllWithClientAndProduct();

        assertThat(orders).hasSize(2);
        // LEFT JOIN FETCH o.client must materialise the JOINED subclass, not a
        // bare Client proxy — TaskService downcasts to Company/Individual to
        // build the task's clientName.
        assertThat(orders).allSatisfy(order ->
                assertThat(order.getClient()).isInstanceOfAny(Company.class, Individual.class));
    }

    @Test
    void findByIdWithClientAndProduct_returnsTheConcreteSubtype() {
        RidicareOrder saved = pickup(acme, CABIN, SITE_A, 4);
        em.flush();
        em.clear();

        Order found = orderRepository.findByIdWithClientAndProduct(saved.getId()).orElseThrow();

        assertThat(found).isInstanceOf(RidicareOrder.class);
        assertThat(((RidicareOrder) found).getPickupQuantity()).isEqualTo(4);
    }

    @Test
    void existsByAmplasareOrderProductId_onlyCountsPlacementOrders() {
        // A Ridicare order references a product too, but the guard that stops
        // ProductService from deleting an in-use product looks at Amplasari only.
        RidicareOrder rid = pickup(acme, CABIN, SITE_A, 1);
        rid.setProduct(shower);
        em.persist(rid);
        em.flush();
        em.clear();

        assertThat(orderRepository.existsByAmplasareOrderProductId(shower.getId())).isFalse();

        placement(acme, shower, SITE_A, 1);
        em.flush();
        em.clear();

        assertThat(orderRepository.existsByAmplasareOrderProductId(shower.getId())).isTrue();
    }

    // -----------------------------------------------------------------------
    // Ridicare availability sums
    // -----------------------------------------------------------------------

    @Test
    void sumAmplasareQuantity_addsUpEveryPlacementAtThatClientLocationAndProduct() {
        placement(acme, cabin, SITE_A, 3);
        placement(acme, cabin, SITE_A, 4);
        em.flush();
        em.clear();

        int total = orderRepository
                .sumAmplasareQuantityByClientLocationAndProduct(acme.getId(), SITE_A, CABIN);

        assertThat(total).isEqualTo(7);
    }

    @Test
    void sumAmplasareQuantity_returnsZeroRatherThanNullWhenNothingMatches() {
        // COALESCE(SUM(...), 0): an empty SUM is NULL in SQL, and an int-typed
        // repository method would NPE on unboxing without the COALESCE.
        assertThat(orderRepository
                .sumAmplasareQuantityByClientLocationAndProduct(acme.getId(), SITE_A, CABIN))
                .isZero();
        assertThat(orderRepository
                .sumRidicareQuantityByClientLocationAndProduct(acme.getId(), SITE_A, CABIN))
                .isZero();
    }

    @Test
    void sumAmplasareQuantity_isScopedByLocationProductAndClient() {
        placement(acme, cabin, SITE_A, 3);   // the one that should count
        placement(acme, cabin, SITE_B, 10);  // different site
        placement(acme, shower, SITE_A, 20); // different product
        placement(ion, cabin, SITE_A, 40);   // different client
        em.flush();
        em.clear();

        assertThat(orderRepository
                .sumAmplasareQuantityByClientLocationAndProduct(acme.getId(), SITE_A, CABIN))
                .isEqualTo(3);
    }

    @Test
    void sumRidicareQuantity_addsUpClaimsAtThatLocation() {
        pickup(acme, CABIN, SITE_A, 2);
        pickup(acme, CABIN, SITE_A, 1);
        pickup(acme, CABIN, SITE_B, 50);
        pickup(ion, CABIN, SITE_A, 50);
        em.flush();
        em.clear();

        assertThat(orderRepository
                .sumRidicareQuantityByClientLocationAndProduct(acme.getId(), SITE_A, CABIN))
                .isEqualTo(3);
    }

    /**
     * CURRENT BEHAVIOUR, worth knowing before touching either side: the two
     * halves of the availability check are joined by *different keys*. The
     * placement side matches on {@code o.product.name}; the pickup side matches
     * on the denormalised {@code pickupProductName} string that the client sent.
     * Renaming a Product therefore retroactively changes how much is considered
     * "placed" at a site, while historical Ridicare rows keep the old name.
     */
    @Test
    void availability_isMatchedOnProductNameSoRenamingAProductShiftsTheBalance() {
        placement(acme, cabin, SITE_A, 5);
        pickup(acme, CABIN, SITE_A, 2);
        em.flush();
        em.clear();

        assertThat(available(acme.getId(), SITE_A, CABIN)).isEqualTo(3);

        Product renamed = em.find(Product.class, cabin.getId());
        renamed.setName("Toaletă Standard v2");
        em.flush();
        em.clear();

        // The placements moved to the new name; the pickup did not follow.
        assertThat(available(acme.getId(), SITE_A, CABIN)).isEqualTo(-2);
        assertThat(available(acme.getId(), SITE_A, "Toaletă Standard v2")).isEqualTo(5);
    }

    private int available(Long clientId, String coords, String productName) {
        return orderRepository.sumAmplasareQuantityByClientLocationAndProduct(clientId, coords, productName)
                - orderRepository.sumRidicareQuantityByClientLocationAndProduct(clientId, coords, productName);
    }
}
