package com.example.damiProd.service;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Company;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.domain.Order;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskPhoto;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.TaskPhotoRepository;
import com.example.damiProd.repository.TaskRepository;
import com.example.damiProd.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClientService {

    private final ClientRepository clientRepository;
    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final TaskPhotoRepository taskPhotoRepository;
    private final PhotoService photoService;

    public ClientService(ClientRepository clientRepository, OrderRepository orderRepository,
                         TaskRepository taskRepository, TaskPhotoRepository taskPhotoRepository,
                         PhotoService photoService) {
        this.clientRepository = clientRepository;
        this.orderRepository = orderRepository;
        this.taskRepository = taskRepository;
        this.taskPhotoRepository = taskPhotoRepository;
        this.photoService = photoService;
    }

    public Client saveClient(Client client) {
        return clientRepository.save(client);
    }

    public List<Client> getAllClients() {
        return clientRepository.findAll();
    }

    public Client getClientById(Long id) {
        return clientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + id));
    }

    public Client updateClient(Long id, Client clientDetails) {
        Client existingClient = getClientById(id);

        existingClient.setEmail(clientDetails.getEmail());
        existingClient.setPhone(clientDetails.getPhone());
        existingClient.setAddress(clientDetails.getAddress());

        // Subtype fields only move across when the payload is the SAME subtype:
        // a Company body must never be able to rewrite an Individual row.
        if (existingClient instanceof Individual individual) {
            if (clientDetails instanceof Individual individualDetails) {
                individual.setFullName(individualDetails.getFullName());
                individual.setCNP(individualDetails.getCNP());
            }
        } else if (existingClient instanceof Company company) {
            if (clientDetails instanceof Company companyDetails) {
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
        deleteClientIdPhoto(id);
        clientRepository.deleteById(id);
    }

    @Transactional
    public void deleteClientCascade(Long id) {
        List<Order> orders = orderRepository.findByClientId(id);
        for (Order order : orders) {
            // EVERY task of the order, not just the first (TODO-34): the orders
            // are deleted below, so a task left behind fails the delete on its
            // FK — and its photos would be orphaned in Spaces either way.
            for (Task task : taskRepository.findAllByOrder_IdOrderByIdAsc(order.getId())) {
                // Delete task photos from Digital Ocean Spaces before removing task
                List<TaskPhoto> photos = taskPhotoRepository.findByTaskId(task.getId());
                for (TaskPhoto photo : photos) {
                    photoService.deletePhoto(photo.getImageUrl());
                }
                taskPhotoRepository.deleteAll(photos);
                taskRepository.delete(task);
            }
        }
        taskRepository.flush();
        for (Order order : orders) {
            orderRepository.delete(order);
        }
        orderRepository.flush();
        // Delete client's ID photo from Digital Ocean Spaces
        deleteClientIdPhoto(id);
        clientRepository.deleteById(id);
    }

    /**
     * Deletes the ID photo of an Individual client from Digital Ocean Spaces.
     */
    private void deleteClientIdPhoto(Long clientId) {
        clientRepository.findById(clientId).ifPresent(client -> {
            if (client instanceof Individual individual) {
                String photoUrl = individual.getIdPhotoUrl();
                if (photoUrl != null && !photoUrl.isEmpty()) {
                    photoService.deletePhoto(photoUrl);
                }
            }
        });
    }
}
