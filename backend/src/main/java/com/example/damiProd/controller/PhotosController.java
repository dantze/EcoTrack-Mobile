package com.example.damiProd.controller;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import com.example.damiProd.service.PhotoService;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.repository.ClientRepository;

@RestController
@RequestMapping("/api")
public class PhotosController {

    private final PhotoService photoService;
    private final ClientRepository clientRepository;
    private final String clientIdsFolderName = "persoane fizice/";

    public PhotosController(PhotoService photoService, ClientRepository clientRepository) {
        this.photoService = photoService;
        this.clientRepository = clientRepository;
    }

    @PostMapping("/{clientId}/idPhoto")
    public String uploadFile(@RequestParam("file") MultipartFile file, @PathVariable Long clientId) {
        if (file.isEmpty()) {
            return "Upload failed: file is empty.";
        }

        try {
            // 1. Upload to DigitalOcean Spaces
            System.out.println("Uploading file: " + file.getOriginalFilename());
            // 2. Find Client FIRST
            Client client = clientRepository.findById(clientId).orElse(null);
            System.out.println("Client found: " + client);

            if (client instanceof Individual) {
                Individual individual = (Individual) client;

                // Construct custom filename: "ID_FullName" (e.g., "123_JohnDoe")
                String customFileName = clientId + "_" + individual.getFullName().replaceAll("\\s+", "");

                String publicUrl = photoService.uploadPhoto(file, clientIdsFolderName, customFileName);

                System.out.println("Public URL: " + publicUrl);

                individual.setIdPhotoUrl(publicUrl);
                clientRepository.save(individual);
                return "Upload successful! Photo saved to client profile. URL: " + publicUrl;
            } else if (client == null) {
                return "Upload successful, but Client ID " + clientId + " not found.";
            } else {
                return "Upload successful, but client is not an Individual (Type: "
                        + client.getClass().getSimpleName() + ")";
            }

        } catch (Exception e) {
            e.printStackTrace();
            return "Upload failed due to server error: " + e.getMessage();
        }
    }

    @DeleteMapping("/{clientId}/idPhoto")
    public String deletePhoto(@PathVariable Long clientId) {
        try {
            Client client = clientRepository.findById(clientId).orElse(null);

            if (client instanceof Individual) {
                Individual individual = (Individual) client;
                String photoUrl = individual.getIdPhotoUrl();

                if (photoUrl == null || photoUrl.isEmpty()) {
                    return "No photo to delete for client ID " + clientId;
                }

                // Delete from DigitalOcean Spaces
                boolean deleted = photoService.deletePhoto(photoUrl);

                // Clear the URL from the database
                individual.setIdPhotoUrl(null);
                clientRepository.save(individual);

                if (deleted) {
                    return "Photo deleted successfully for client ID " + clientId;
                } else {
                    return "Photo reference cleared, but file may not have been found in storage.";
                }
            } else if (client == null) {
                return "Client ID " + clientId + " not found.";
            } else {
                return "Client is not an Individual (Type: " + client.getClass().getSimpleName() + ")";
            }

        } catch (Exception e) {
            e.printStackTrace();
            return "Delete failed due to server error: " + e.getMessage();
        }
    }
}
