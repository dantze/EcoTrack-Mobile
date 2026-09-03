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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClientService {

    private static final Logger log = LoggerFactory.getLogger(ClientService.class);

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
                    // The cascade continues either way (see PhotoService.deletePhoto),
                    // but this is the last moment anything knows WHOSE photo it was:
                    // the task and the client rows are about to go (TODO-25).
                    if (!photoService.deletePhoto(photo.getImageUrl())) {
                        log.warn("Orphaned task photo {} (task {}, client {}) — the row is being "
                                + "deleted, the object was not", photo.getImageUrl(), task.getId(), id);
                    }
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
        // deleteClientIdPhoto(id) was called here and above, deleting the
        // client's stored identity document from Spaces before the row that
        // referenced it went. Nothing stores one any more (TODO-14) and the
        // legacy objects are drained (TODO-45), so there is nothing to delete.
        // Task photos above are a different thing and still cascade.
        clientRepository.deleteById(id);
    }
}
