package com.example.damiProd.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class PhotoService {

    /**
     * What callers are allowed to upload. Lives here rather than on each
     * controller because both upload endpoints (task photos, client ID photos)
     * must accept the same set - when this list was duplicated, adding a format
     * to one endpoint silently left the other rejecting it.
     */
    public static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif");

    @Value("${spaces.access-key}")
    private String accessKey;

    @Value("${spaces.secret-key}")
    private String secretKey;

    @Value("${spaces.bucket}")
    private String bucketName;

    @Value("${spaces.region}")
    private String region;

    private S3Client s3Client;

    /**
     * Initialize S3 client lazily (after Spring injects properties).
     * DigitalOcean Spaces uses an S3-compatible API, so we point the
     * AWS SDK at the Spaces endpoint instead of AWS.
     */
    private S3Client getS3Client() {
        if (s3Client == null) {
            String endpoint = String.format("https://%s.digitaloceanspaces.com", region);
            s3Client = S3Client.builder()
                    .endpointOverride(URI.create(endpoint))
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        }
        return s3Client;
    }

    /**
     * Uploads a file to a specific folder with a custom filename.
     *
     * @param file           The MultipartFile to upload.
     * @param folder         The folder path.
     * @param customFileName The desired filename (without extension). Can be null.
     * @return The public URL of the uploaded file.
     * @throws IOException If an I/O error occurs.
     */
    public String uploadPhoto(MultipartFile file, String folder, String customFileName) throws IOException {
        String originalFileName = file.getOriginalFilename();
        if (originalFileName == null) {
            originalFileName = "unknown.jpg";
        }

        // Extract file extension
        String extension = "";
        int i = originalFileName.lastIndexOf('.');
        if (i > 0) {
            extension = originalFileName.substring(i);
        }

        // Build filename
        String fileName;
        if (customFileName != null && !customFileName.isEmpty()) {
            // Sanitize custom filename
            fileName = customFileName.replaceAll("[^a-zA-Z0-9.-]", "_") + extension;
        } else {
            // Default logic: Timestamp + UUID
            fileName = System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + "_"
                    + originalFileName.replaceAll("\\s+", "_");
        }

        // Prepend folder if provided
        String objectName = fileName;
        if (folder != null && !folder.isEmpty()) {
            if (!folder.endsWith("/")) {
                folder += "/";
            }
            objectName = folder + fileName;
        }

        // Upload to DigitalOcean Spaces
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(objectName)
                .contentType(file.getContentType())
                .acl(ObjectCannedACL.PUBLIC_READ) // Make file publicly readable
                .build();

        getS3Client().putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        // Return the public CDN URL
        return String.format("https://%s.%s.digitaloceanspaces.com/%s", bucketName, region, objectName);
    }

    /**
     * Deletes a photo from DigitalOcean Spaces given its full URL or object name.
     *
     * @param photoUrlOrName The full URL or just the object name.
     * @return true if delete request was sent successfully.
     */
    public boolean deletePhoto(String photoUrlOrName) {
        String objectName = extractObjectName(photoUrlOrName);

        DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(objectName)
                .build();

        try {
            getS3Client().deleteObject(deleteRequest);
            return true;
        } catch (Exception e) {
            System.err.println("Failed to delete photo: " + e.getMessage());
            return false;
        }
    }

    /**
     * Lists all photo URLs in the configured bucket.
     *
     * @return A list of public URLs for all objects in the bucket.
     */
    public List<String> getPhotos() {
        List<String> photoUrls = new ArrayList<>();

        ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .build();

        ListObjectsV2Response response = getS3Client().listObjectsV2(listRequest);
        for (S3Object obj : response.contents()) {
            photoUrls.add(String.format("https://%s.%s.digitaloceanspaces.com/%s",
                    bucketName, region, obj.key()));
        }

        return photoUrls;
    }

    /**
     * Extracts the object name from a full Spaces URL or returns the input as-is.
     */
    private String extractObjectName(String input) {
        String prefix = String.format("https://%s.%s.digitaloceanspaces.com/", bucketName, region);
        if (input.startsWith(prefix)) {
            return input.substring(prefix.length());
        }
        return input;
    }
}