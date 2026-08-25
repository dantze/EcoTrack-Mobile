package com.example.damiProd.DomainTests;

import com.example.damiProd.domain.AmplasareOrder;
import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.RidicareOrder;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pins down the {@code @JsonSubTypes} dispatch on {@link Order}.
 *
 * CLAUDE.md calls this out as a cross-cutting contract: the discriminator
 * names here ("Amplasari" / "Ridicari" / "Igienizari") are duplicated in
 * {@code web/src/features/sales/orderModel.ts} and
 * {@code mobile/types/OrderTypes.ts}. If someone renames a subtype or the
 * {@code orderType} property, these tests fail before the clients silently
 * start receiving objects they cannot dispatch on.
 *
 * The mapper is the one Spring Boot actually builds for the app, not a bare
 * {@code new ObjectMapper()}, so the assertions describe the wire format the
 * controllers really emit.
 */
class OrderJsonSubTypesTest {

    private static final ObjectMapper MAPPER = springBootObjectMapper();

    private static ObjectMapper springBootObjectMapper() {
        AtomicReference<ObjectMapper> ref = new AtomicReference<>();
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class))
                .run(context -> ref.set(context.getBean(ObjectMapper.class)));
        return ref.get();
    }

    // -----------------------------------------------------------------------
    // Deserialisation: discriminator -> concrete subclass
    // -----------------------------------------------------------------------

    @Test
    void amplasariDiscriminator_deserialisesToAmplasareOrder() throws Exception {
        String json = """
                {
                  "orderType": "Amplasari",
                  "quantity": 4,
                  "isIndefinite": false,
                  "durationDays": 30,
                  "startDate": "2026-01-05",
                  "locationAddress": "Str. Amplasare 1",
                  "locationCoordinates": "44.43,26.10",
                  "igienizariPerMonth": 2,
                  "contact": "Ion Pop"
                }
                """;

        Order order = MAPPER.readValue(json, Order.class);

        assertThat(order).isInstanceOf(AmplasareOrder.class);
        AmplasareOrder amp = (AmplasareOrder) order;
        assertThat(amp.getQuantity()).isEqualTo(4);
        assertThat(amp.getDurationDays()).isEqualTo(30);
        assertThat(amp.getLocationCoordinates()).isEqualTo("44.43,26.10");
        assertThat(amp.getIgienizariPerMonth()).isEqualTo(2);
        assertThat(amp.getContact()).isEqualTo("Ion Pop");
        // `visible = true` on @JsonTypeInfo: the discriminator is also bound to
        // the field, not swallowed by the type resolver. The entity persists it.
        assertThat(amp.getOrderType()).isEqualTo("Amplasari");
    }

    @Test
    void ridicariDiscriminator_deserialisesToRidicareOrder() throws Exception {
        String json = """
                {
                  "orderType": "Ridicari",
                  "pickupDate": "2026-02-01",
                  "pickupQuantity": 2,
                  "pickupProductName": "Toaletă Standard",
                  "pickupLocationAddress": "Str. Ridicare 9",
                  "pickupLocationCoordinates": "44.40,26.05"
                }
                """;

        Order order = MAPPER.readValue(json, Order.class);

        assertThat(order).isInstanceOf(RidicareOrder.class);
        RidicareOrder rid = (RidicareOrder) order;
        assertThat(rid.getPickupQuantity()).isEqualTo(2);
        assertThat(rid.getPickupProductName()).isEqualTo("Toaletă Standard");
        assertThat(rid.getPickupLocationCoordinates()).isEqualTo("44.40,26.05");
        assertThat(rid.getOrderType()).isEqualTo("Ridicari");
    }

    @Test
    void igienizariDiscriminator_deserialisesToIgienizareOrder() throws Exception {
        String json = """
                {
                  "orderType": "Igienizari",
                  "sanitationDate": "2026-03-15",
                  "sanitationLocationAddress": "Str. Igienă 3",
                  "sanitationLocationCoordinates": "44.41,26.06",
                  "subscription": { "id": 7 }
                }
                """;

        Order order = MAPPER.readValue(json, Order.class);

        assertThat(order).isInstanceOf(IgienizareOrder.class);
        IgienizareOrder igi = (IgienizareOrder) order;
        assertThat(igi.getSanitationDate()).isEqualTo("2026-03-15");
        assertThat(igi.getSubscription()).isNotNull();
        assertThat(igi.getSubscription().getId()).isEqualTo(7L);
        assertThat(igi.getOrderType()).isEqualTo("Igienizari");
    }

    @Test
    void unknownDiscriminator_isRejectedRatherThanSilentlyDefaulted() {
        String json = "{\"orderType\":\"Reparatii\"}";

        // There is no @JsonTypeInfo defaultImpl, so an unmapped order type is a
        // hard 400 rather than an Amplasare with missing fields. Adding a fourth
        // order type therefore *must* touch the @JsonSubTypes list.
        assertThatThrownBy(() -> MAPPER.readValue(json, Order.class))
                .isInstanceOf(Exception.class);
    }

    @Test
    void missingDiscriminator_isRejected() {
        assertThatThrownBy(() -> MAPPER.readValue("{\"contact\":\"x\"}", Order.class))
                .isInstanceOf(Exception.class);
    }

    // -----------------------------------------------------------------------
    // Serialisation: the discriminator survives the round trip
    // -----------------------------------------------------------------------

    @Test
    void serialisedOrder_carriesTheOrderTypeDiscriminator() throws Exception {
        RidicareOrder rid = new RidicareOrder();
        rid.setOrderType("Ridicari");
        rid.setPickupQuantity(3);

        ObjectNode node = (ObjectNode) MAPPER.readTree(MAPPER.writeValueAsString(rid));

        assertThat(node.get("orderType").asText()).isEqualTo("Ridicari");
        assertThat(node.get("pickupQuantity").asInt()).isEqualTo(3);
    }

    @Test
    void everySubtypeRoundTripsThroughTheAbstractBaseType() throws Exception {
        AmplasareOrder amp = new AmplasareOrder();
        amp.setOrderType("Amplasari");
        amp.setQuantity(1);

        IgienizareOrder igi = new IgienizareOrder();
        igi.setOrderType("Igienizari");
        igi.setSanitationDate("2026-04-01");

        RidicareOrder rid = new RidicareOrder();
        rid.setOrderType("Ridicari");
        rid.setPickupQuantity(9);

        for (Order original : new Order[] { amp, igi, rid }) {
            String json = MAPPER.writeValueAsString(original);
            Order back = MAPPER.readValue(json, Order.class);
            assertThat(back).isInstanceOf(original.getClass());
            assertThat(back.getOrderType()).isEqualTo(original.getOrderType());
        }
    }

    /**
     * `recurringPlan` is @JsonIgnore and replaced by a transient getter. This is
     * exactly the wire/domain mismatch `web/src/api/live/normalize.ts` absorbs
     * (see its RawOrder.recurringPlanId field) — if the property ever moves,
     * the web app breaks silently, so nail it down here too.
     */
    @Test
    void igienizareOrder_exposesRecurringPlanIdNotTheAssociation() throws Exception {
        IgienizareOrder igi = new IgienizareOrder();
        igi.setOrderType("Igienizari");

        ObjectNode node = (ObjectNode) MAPPER.readTree(MAPPER.writeValueAsString(igi));

        assertThat(node.has("recurringPlan")).isFalse();
        assertThat(node.has("recurringPlanId")).isTrue();
        assertThat(node.get("recurringPlanId").isNull()).isTrue();
    }
}
