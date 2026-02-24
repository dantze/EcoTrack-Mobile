package com.example.damiProd.service;

import com.example.damiProd.domain.Client;
import com.example.damiProd.repository.ClientRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClientService {

    private final ClientRepository clientRepository;

    public ClientService(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    public Client saveClient(Client client) {
        return clientRepository.save(client);
    }

    public List<Client> getAllClients() {
        return clientRepository.findAll();
    }

    public Client getClientById(Long id) {
        return clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));
    }

    public Client updateClient(Long id, Client clientDetails) {
        Client existingClient = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));

        existingClient.setEmail(clientDetails.getEmail());
        existingClient.setPhone(clientDetails.getPhone());
        existingClient.setAddress(clientDetails.getAddress());

        if (existingClient instanceof com.example.damiProd.domain.Individual individual) {
            if (clientDetails instanceof com.example.damiProd.domain.Individual individualDetails) {
                individual.setFullName(individualDetails.getFullName());
            }
        } else if (existingClient instanceof com.example.damiProd.domain.Company company) {
            if (clientDetails instanceof com.example.damiProd.domain.Company companyDetails) {
                company.setName(companyDetails.getName());
                company.setCUI(companyDetails.getCUI());
                company.setAdminName(companyDetails.getAdminName());
            }
        }

        return clientRepository.save(existingClient);
    }

    public void deleteClient(Long id) {
        clientRepository.deleteById(id);
    }
}
