package com.example.damiProd.DomainTests;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Individual;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pins down the {@code Client -> Individual / Company} Jackson dispatch.
 *
 * Unlike {@link com.example.damiProd.domain.Order}, {@code Client} is a
 * *concrete* base class with an explicit {@code As.PROPERTY} discriminator
 * called "type" (not "orderType"), and it is annotated
 * {@code @JsonIgnoreProperties(ignoreUnknown = true)}. Those three differences
 * are all load-bearing for the web client's {@code normalizeClient()}, which
 * branches on {@code raw.type === 'company'} and otherwise falls through to
 * individual.
 *
 * Two of these tests pin CURRENT-BUT-WRONG behaviour around the CNP/CUI
 * property casing — read their javadoc before "fixing" either side.
 */
class ClientJsonSubTypesTest {

    private static final ObjectMapper MAPPER = springBootObjectMapper();

    private static ObjectMapper springBootObjectMapper() {
        AtomicReference<ObjectMapper> ref = new AtomicReference<>();
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class))
                .run(context -> ref.set(context.getBean(ObjectMapper.class)));
        return ref.get();
    }

    @Test
    void individualDiscriminator_deserialisesToIndividual() throws Exception {
        String json = """
                {
                  "type": "individual",
                  "email": "ion@example.ro",
                  "phone": "0722000111",
                  "address": "Str. Persoanei 4",
                  "fullName": "Ion Popescu",
                  "cnp": "1900101123456"
                }
                """;

        Client client = MAPPER.readValue(json, Client.class);

        assertThat(client).isInstanceOf(Individual.class);
        Individual individual = (Individual) client;
        assertThat(individual.getFullName()).isEqualTo("Ion Popescu");
        assertThat(individual.getCNP()).isEqualTo("1900101123456");
        assertThat(individual.getEmail()).isEqualTo("ion@example.ro");
    }

    /**
     * ⚠ BUG PINNED BY THIS TEST — the property is lowercase {@code cnp} on the
     * wire, NOT {@code CNP}.
     *
     * {@link com.example.damiProd.domain.Company#getCUI()} carries an explicit
     * {@code @JsonProperty("CUI")}; {@link Individual#getCNP()} does not, so
     * Jackson bean-names it {@code cnp}. Combined with
     * {@code @JsonIgnoreProperties(ignoreUnknown = true)} on {@link Client},
     * a client that POSTs {@code "CNP"} has the value SILENTLY DROPPED — no
     * 400, no log line, just a null column.
     *
     * That is exactly what {@code web/src/api/live/normalize.ts} does today:
     * its {@code RawClient} declares {@code CNP} and {@code normalizeClient}
     * reads {@code raw.CNP}, so in live mode an individual's CNP is lost in
     * both directions. Fixing it means either adding
     * {@code @JsonProperty("CNP")} here (and updating the web + mobile clients)
     * or teaching the clients to use {@code cnp}. Until then this test keeps
     * the mismatch visible instead of latent.
     */
    @Test
    void individualCnp_sentAsUppercase_isSilentlyDropped() throws Exception {
        String json = """
                {"type":"individual","fullName":"Ion Popescu","CNP":"1900101123456"}
                """;

        Individual individual = (Individual) MAPPER.readValue(json, Client.class);

        assertThat(individual.getFullName()).isEqualTo("Ion Popescu");
        assertThat(individual.getCNP())
                .as("uppercase CNP is not a known property and ignoreUnknown swallows it")
                .isNull();
    }

    @Test
    void companyDiscriminator_deserialisesToCompany() throws Exception {
        String json = """
                {
                  "type": "company",
                  "email": "office@acme.ro",
                  "phone": "0311000111",
                  "address": "Bd. Firmei 20",
                  "name": "Acme SRL",
                  "CUI": "RO12345678",
                  "adminName": "Maria Ionescu"
                }
                """;

        Client client = MAPPER.readValue(json, Client.class);

        assertThat(client).isInstanceOf(Company.class);
        Company company = (Company) client;
        assertThat(company.getName()).isEqualTo("Acme SRL");
        assertThat(company.getCUI()).isEqualTo("RO12345678");
        assertThat(company.getAdminName()).isEqualTo("Maria Ionescu");
    }

    /**
     * CURRENT BEHAVIOUR: {@code @JsonProperty("CUI")} sits on the FIELD while
     * Lombok also generates {@code getCUI()}, which Jackson bean-names
     * {@code cui}. The two are not merged, so a serialised Company carries the
     * registration code TWICE, under both spellings. The web client reads
     * {@code CUI}, so it works — but anything that round-trips the object back
     * is sending a duplicate, and removing either spelling is a breaking change
     * for one of the clients.
     */
    @Test
    void companySerialisation_emitsCuiUnderBothSpellings() throws Exception {
        Company company = new Company("office@acme.ro", "0311", "Bd. 20", "Acme SRL", "RO12345678", "Maria");

        ObjectNode node = (ObjectNode) MAPPER.readTree(MAPPER.writeValueAsString(company));

        assertThat(node.get("type").asText()).isEqualTo("company");
        assertThat(node.get("CUI").asText()).isEqualTo("RO12345678");
        assertThat(node.get("cui").asText())
                .as("duplicate lowercase spelling from the Lombok getter")
                .isEqualTo("RO12345678");
    }

    /**
     * The counterpart of {@link #individualCnp_sentAsUppercase_isSilentlyDropped}
     * on the way out: an Individual serialises its personal code as
     * {@code cnp}, so {@code web/src/api/live/normalize.ts} — which reads
     * {@code raw.CNP} — always sees undefined and normalises it to null.
     */
    @Test
    void individualSerialisation_emitsLowercaseCnpOnly() throws Exception {
        Individual individual = new Individual("ion@example.ro", "0722", "Str. 4", "Ion Popescu", "1900101123456");
        individual.setIdPhotoUrl("https://cdn.example/id.jpg");

        ObjectNode node = (ObjectNode) MAPPER.readTree(MAPPER.writeValueAsString(individual));

        assertThat(node.get("type").asText()).isEqualTo("individual");
        assertThat(node.get("fullName").asText()).isEqualTo("Ion Popescu");
        assertThat(node.get("cnp").asText()).isEqualTo("1900101123456");

        // The ID photo URL must not leave the server (TODO-14). Those objects
        // were written with a PUBLIC_READ ACL, so the value is a working
        // unauthenticated link to a scan of someone's identity card, and this
        // field is on every client the app lists. @JsonIgnore on the field is
        // what stops it; this asserts the annotation is still there, because
        // removing it would leak silently rather than fail.
        assertThat(node.has("idPhotoUrl"))
                .as("legacy ID photo URL must never be serialised again")
                .isFalse();
        assertThat(node.has("CNP"))
                .as("no @JsonProperty(\"CNP\") on Individual, unlike Company's CUI")
                .isFalse();
    }

    @Test
    void unknownProperties_areIgnoredNotRejected() throws Exception {
        // @JsonIgnoreProperties(ignoreUnknown = true) on Client: the web client
        // may round-trip extra fields (it sends back what it received) without
        // the backend 400-ing.
        String json = """
                {"type":"company","name":"Acme SRL","somethingTheUiAdded":42}
                """;

        Client client = MAPPER.readValue(json, Client.class);

        assertThat(client).isInstanceOf(Company.class);
        assertThat(((Company) client).getName()).isEqualTo("Acme SRL");
    }

    @Test
    void unknownDiscriminator_isRejected() {
        assertThatThrownBy(() -> MAPPER.readValue("{\"type\":\"ngo\",\"name\":\"X\"}", Client.class))
                .isInstanceOf(Exception.class);
    }

    /**
     * Even though {@link Client} is a CONCRETE class, there is no
     * {@code defaultImpl} on its {@code @JsonTypeInfo}, so a payload with no
     * "type" is rejected rather than silently becoming a nameless base Client.
     * The web contract's {@code ClientInput} always carries the discriminator
     * for exactly this reason.
     */
    @Test
    void missingDiscriminator_isRejectedRatherThanDefaultingToBaseClient() {
        assertThatThrownBy(() -> MAPPER.readValue("{\"email\":\"x@y.ro\"}", Client.class))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("missing type id property 'type'");
    }
}
