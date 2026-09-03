package com.example.damiProd;

import com.example.damiProd.controller.ClientController;
import com.example.damiProd.service.ClientService;
import com.example.damiProd.repository.ClientRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

// @SpringBootTest boots the full application context (all beans, DB, etc.)
// @ActiveProfiles("test") makes Spring load application-test.properties,
// which uses an in-memory H2 DB so tests never touch the real data file.
@SpringBootTest
@AutoConfigureTestDatabase
@ActiveProfiles("test")
class DamiProdApplicationTests {

    @Autowired
    private ClientController clientController;

    @Autowired
    private ClientService clientService;

    @Autowired
    private ClientRepository clientRepository;

    // Verifies the full Spring context starts without errors.
    // If any bean fails to initialize (bad config, missing dependency, etc.) this fails.
    @Test
    void contextLoads() {
    }

    // Verifies that the core beans are actually present in the context (not null).
    @Test
    void coreBeansShouldBeLoaded() {
        assertThat(clientController).isNotNull();
        assertThat(clientService).isNotNull();
        assertThat(clientRepository).isNotNull();
    }
}
