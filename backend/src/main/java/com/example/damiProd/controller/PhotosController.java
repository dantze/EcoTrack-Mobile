package com.example.damiProd.controller;

import com.example.damiProd.domain.Client;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.service.PhotoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api")
public class PhotosController {

    private static final Logger log = LoggerFactory.getLogger(PhotosController.class);

    private final PhotoService photoService;
    private final ClientRepository clientRepository;
    private final String clientIdsFolderName = "persoane fizice/";

    public PhotosController(PhotoService photoService, ClientRepository clientRepository) {
        this.photoService = photoService;
        this.clientRepository = clientRepository;
    }

    @PostMapping("/{clientId}/idPhoto")
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file, @PathVariable Long clientId) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Upload failed: file is empty.");
        }

        String contentType = file.getContentType();
        if (contentType != null && !PhotoService.ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body("Upload failed: Only standard image formats (JPEG, PNG, WEBP, HEIC) are accepted.");
        }

        try {
            Client client = clientRepository.findById(clientId).orElse(null);
            if (client == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Upload failed: Client ID " + clientId + " not found.");
            }

            if (!(client instanceof Individual individual)) {
                return ResponseEntity.badRequest()
                        .body("Upload failed: Client is not an Individual (Type: " + client.getClass().getSimpleName() + ").");
            }

            // Construct sanitized custom filename: "ID_FullName"
            String sanitizedName = individual.getFullName() != null
                    ? individual.getFullName().replaceAll("[^a-zA-Z0-9]", "")
                    : "Individual";
            String customFileName = clientId + "_" + sanitizedName;

            String publicUrl = photoService.uploadPhoto(file, clientIdsFolderName, customFileName);
            individual.setIdPhotoUrl(publicUrl);
            clientRepository.save(individual);

            return ResponseEntity.ok("Upload successful! Photo saved to client profile. URL: " + publicUrl);

        } catch (Exception e) {
            log.error("Failed to upload ID photo for client ID {}", clientId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Upload failed due to internal storage error. Please try again.");
        }
    }

    @DeleteMapping("/{clientId}/idPhoto")
    public ResponseEntity<String> deletePhoto(@PathVariable Long clientId) {
        try {
            Client client = clientRepository.findById(clientId).orElse(null);
            if (client == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Client ID " + clientId + " not found.");
            }

            if (!(client instanceof Individual individual)) {
                return ResponseEntity.badRequest()
                        .body("Client is not an Individual (Type: " + client.getClass().getSimpleName() + ").");
            }

            String photoUrl = individual.getIdPhotoUrl();
            if (photoUrl == null || photoUrl.isEmpty()) {
                return ResponseEntity.ok("No photo to delete for client ID " + clientId);
            }

            boolean deleted = photoService.deletePhoto(photoUrl);
            individual.setIdPhotoUrl(null);
            clientRepository.save(individual);

            if (deleted) {
                return ResponseEntity.ok("Photo deleted successfully for client ID " + clientId);
            } else {
                return ResponseEntity.ok("Photo reference cleared, but file may not have been found in storage.");
            }

        } catch (Exception e) {
            log.error("Failed to delete ID photo for client ID {}", clientId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Delete failed due to internal storage error.");
        }
    }

    @GetMapping("/photos")
    public ResponseEntity<List<String>> getAllPhotos() {
        return ResponseEntity.ok(photoService.getPhotos());
    }
}
