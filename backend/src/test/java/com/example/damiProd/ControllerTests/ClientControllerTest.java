package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.ClientController;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.service.ClientService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// --- WHAT IS @WebMvcTest? ---
// Loads ONLY the web layer (controller + MockMvc). Does NOT start the full
// Spring context or connect to a database — making tests fast and focused.
// We supply a fake (mock) ClientService so tests never touch real data.
@WebMvcTest(ClientController.class)
// Security filters are disabled in this slice: this test targets controller/service
// wiring, not auth. @WebMvcTest does not pick up the app's own SecurityConfig, so
// without this the default Spring Boot Security auto-config would 401 everything.
@AutoConfigureMockMvc(addFilters = false)
class ClientControllerTest {

    // MockMvc lets us fire fake HTTP requests at the controller and inspect
    // the response (status code, JSON body, headers) without a real server.
    @Autowired
    private MockMvc mockMvc;

    // @MockBean replaces the real ClientService with a Mockito mock so we
    // can control exactly what it returns for each test.
    @MockitoBean
    private ClientService clientService;

    // -----------------------------------------------------------------------
    // TEST 1 — GET /api/clients  →  should return a list of clients as JSON
    // -----------------------------------------------------------------------
    @Test
    void getAllClients_shouldReturn200WithClientList() throws Exception {
        // ARRANGE: tell the mock what to return when getAllClients() is called
        Individual individual = new Individual("ion@test.ro", "0712345678", "Str. Test 1", "Ion Pop", "1234567890123");
        individual.setId(1L); // set the ID manually (no DB here)

        when(clientService.getAllClients()).thenReturn(List.of(individual));

        // ACT + ASSERT: perform GET and verify the response
        mockMvc.perform(get("/api/clients"))
                .andExpect(status().isOk())                               // HTTP 200
                .andExpect(jsonPath("$[0].email").value("ion@test.ro"))   // first item's email
                .andExpect(jsonPath("$[0].type").value("individual"));    // polymorphic type field
    }

    // -----------------------------------------------------------------------
    // TEST 2 — POST /api/clients  →  create a Company, CUI must be saved
    // This directly validates the bug we fixed with @JsonProperty("CUI")
    // -----------------------------------------------------------------------
    @Test
    void createCompany_shouldReturn200AndPreserveCUI() throws Exception {
        // ARRANGE: build the object the service will return after saving
        Company company = new Company("firma@test.ro", "0712345678", "Str. Firmei 5", "Test SRL", "RO12345678", "Popescu Ion");
        company.setId(2L);

        // When saveClient() is called with ANY Client argument, return our company
        when(clientService.saveClient(any())).thenReturn(company);

        // Build the request body as a JSON string (same as what the frontend sends)
        String requestBody = """
                {
                    "type": "company",
                    "email": "firma@test.ro",
                    "phone": "0712345678",
                    "address": "Str. Firmei 5",
                    "name": "Test SRL",
                    "CUI": "RO12345678",
                    "adminName": "Popescu Ion"
                }
                """;

        // ACT + ASSERT
        mockMvc.perform(post("/api/clients")
                        .contentType(MediaType.APPLICATION_JSON) // set Content-Type header
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.CUI").value("RO12345678"))  // CUI must not be null
                .andExpect(jsonPath("$.name").value("Test SRL"))
                .andExpect(jsonPath("$.type").value("company"));
    }

    // -----------------------------------------------------------------------
    // TEST 3 — GET /api/clients/{id}  →  should return the correct client
    // -----------------------------------------------------------------------
    @Test
    void getClientById_shouldReturn200WithClient() throws Exception {
        Individual individual = new Individual("maria@test.ro", "0722222222", "Bd. Unirii 10", "Maria Ionescu", "2900101123456");
        individual.setId(5L);

        when(clientService.getClientById(5L)).thenReturn(individual);

        mockMvc.perform(get("/api/clients/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.fullName").value("Maria Ionescu"));
    }

    // -----------------------------------------------------------------------
    // TEST 4 — GET /api/clients/{id}/has-orders  →  should return true/false
    // -----------------------------------------------------------------------
    @Test
    void clientHasOrders_shouldReturnFalseWhenNoOrders() throws Exception {
        when(clientService.clientHasOrders(3L)).thenReturn(false);

        mockMvc.perform(get("/api/clients/3/has-orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasOrders").value(false));
    }

    // -----------------------------------------------------------------------
    // TEST 5 — DELETE /api/clients/{id}  →  should return 204 No Content
    // -----------------------------------------------------------------------
    @Test
    void deleteClient_shouldReturn204() throws Exception {
        // No need to set up a mock return value — deleteClient() returns void.
        // Mockito does nothing by default for void methods, which is correct.

        mockMvc.perform(delete("/api/clients/1"))
                .andExpect(status().isNoContent()); // HTTP 204
    }
}
