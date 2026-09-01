package com.example.damiProd.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.Set;
import java.util.UUID;

@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    /**
     * What callers are allowed to upload.
     *
     * <p>There is one upload endpoint left - task photos. It used to be two:
     * the client ID photo upload was removed with the rest of ID storage
     * (TODO-14), and this set stays here rather than moving onto
     * {@code TaskController} because the reason it was centralised still holds.
     * When the list was duplicated across the two endpoints, adding a format to
     * one silently left the other rejecting it.
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
     * <p><b>A failure is reported, not thrown</b> (TODO-25). Every caller but one
     * is a cascade whose actual job is removing a row — deleting a client, or a
     * client's orders and their task photos. Throwing from here would abort such
     * a delete halfway, after some objects are already gone, leaving a partially
     * deleted client that the operator has no way to finish. The row going and
     * the object staying is recoverable; a half-deleted cascade is not.
     *
     * <p>What was actually broken was the trace: the failure went to stderr with
     * only {@code e.getMessage()}, so it missed the log format, the level and
     * anything shipping logs off the VPS, and it did not even name the object.
     * Once the owning row is deleted the object key exists nowhere else, so this
     * ERROR line is the only remaining way to find what was left behind. It has
     * to carry the key and the cause.
     *
     * @param photoUrlOrName The full URL or just the object name.
     * @return true if the object was deleted; false if it was left in storage.
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
            log.error("Failed to delete object '{}' from bucket '{}'; it stays in storage "
                    + "and this line is the only record of it", objectName, bucketName, e);
            return false;
        }
    }

    // getPhotos() used to live here, behind GET /api/photos: it enumerated the
    // WHOLE bucket and returned every object's public URL to any authenticated
    // employee. While ID photos were stored, that was a one-call listing of
    // every scanned identity document in the company. Both it and its endpoint
    // are gone (TODO-14). Nothing needs to enumerate the bucket; the rows that
    // own an object already know its key.

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