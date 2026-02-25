package com.example.damiProd.service;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Task;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ClientService {

    private final ClientRepository clientRepository;
    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;

    public ClientService(ClientRepository clientRepository, OrderRepository orderRepository, TaskRepository taskRepository) {
        this.clientRepository = clientRepository;
        this.orderRepository = orderRepository;
        this.taskRepository = taskRepository;
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

    public boolean clientHasOrders(Long id) {
        List<Order> orders = orderRepository.findByClientId(id);
        return !orders.isEmpty();
    }

    public void deleteClient(Long id) {
        clientRepository.deleteById(id);
    }

    @Transactional
    public void deleteClientCascade(Long id) {
        List<Order> orders = orderRepository.findByClientId(id);
        for (Order order : orders) {
            Optional<Task> task = taskRepository.findByOrder_Id(order.getId());
            task.ifPresent(t -> taskRepository.delete(t));
        }
        taskRepository.flush();
        for (Order order : orders) {
            orderRepository.delete(order);
        }
        orderRepository.flush();
        clientRepository.deleteById(id);
    }
}
