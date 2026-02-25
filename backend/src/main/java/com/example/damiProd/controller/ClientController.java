package com.example.damiProd.controller;

import com.example.damiProd.domain.Client;
import com.example.damiProd.service.ClientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @PostMapping
    public ResponseEntity<Client> createClient(@RequestBody Client client) {
        Client savedClient = clientService.saveClient(client);
        return ResponseEntity.ok(savedClient);
    }

    @GetMapping
    public ResponseEntity<List<Client>> getAllClients() {
        List<Client> clients = clientService.getAllClients();
        return ResponseEntity.ok(clients);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Client> getClientById(@PathVariable("id") Long id) {
        Client client = clientService.getClientById(id);
        return ResponseEntity.ok(client);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Client> updateClient(@PathVariable("id") Long id, @RequestBody Client clientDetails) {
        Client updatedClient = clientService.updateClient(id, clientDetails);
        return ResponseEntity.ok(updatedClient);
    }

    @GetMapping("/{id}/has-orders")
    public ResponseEntity<Map<String, Boolean>> clientHasOrders(@PathVariable("id") Long id) {
        boolean hasOrders = clientService.clientHasOrders(id);
        return ResponseEntity.ok(Map.of("hasOrders", hasOrders));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClient(@PathVariable("id") Long id, @RequestParam(value = "cascade", defaultValue = "false") boolean cascade) {
        if (cascade) {
            clientService.deleteClientCascade(id);
        } else {
            clientService.deleteClient(id);
        }
        return ResponseEntity.noContent().build();
    }
}
