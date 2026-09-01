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
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.List;
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
    private S3Presigner presigner;

    /**
     * How long a presigned photo URL stays valid.
     *
     * <p>An hour: long enough to open a task, look through its photos and come
     * back, short enough that a leaked link is stale before it is useful. It is
     * not a security boundary on its own - the boundary is
     * {@code requireCanAccessTask} on the endpoint that hands these out.
     */
    private static final Duration PRESIGNED_URL_TTL = Duration.ofHours(1);

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
                // PRIVATE, not PUBLIC_READ (TODO-46). A public-read object is on
                // a working unauthenticated URL forever, and the key is not the
                // secret people assume: it is
                // "poze cabine/{taskId}_{clientName}/{n}" - a small integer, a
                // customer's name, and a counter starting at 1. Anyone who ever
                // sees one URL can walk that client's other photos by changing
                // the last segment. Reads go through presignedUrl() below.
                .acl(ObjectCannedACL.PRIVATE)
                .build();

        getS3Client().putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        // The canonical URL is still what gets stored: it is a stable identity
        // for the object, and extractObjectName() turns it back into a key. It
        // is no longer *usable* on its own - fetching now needs a presigned URL.
        return String.format("https://%s.%s.digitaloceanspaces.com/%s", bucketName, region, objectName);
    }

    /**
     * The presigner, built lazily for the same reason as the client: the
     * @Value fields are not populated until after construction.
     */
    private S3Presigner getPresigner() {
        if (presigner == null) {
            String endpoint = String.format("https://%s.digitaloceanspaces.com", region);
            presigner = S3Presigner.builder()
                    .endpointOverride(URI.create(endpoint))
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        }
        return presigner;
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
     * A time-limited URL that can actually fetch a private object (TODO-46).
     *
     * <p>Objects are written PRIVATE, so the stored URL no longer resolves for
     * anyone. This signs a short-lived GET for it, and the signature is what
     * carries the authorisation - which means <b>the caller must have already
     * decided the requester is allowed to see it</b>. Every caller today is
     * behind {@code TaskAccessPolicy.requireCanAccessTask}; a new one without an
     * equivalent check would hand out access this method cannot withhold.
     *
     * <p>The window is deliberately short but not tiny. Long enough that a
     * driver can open a task, scroll its photos and come back without the images
     * dying mid-view; short enough that a URL copied out of a screenshot, a
     * proxy log or browser history is worthless by the time anyone tries it.
     * Both clients refetch the list whenever the screen opens - web's
     * {@code useTaskPhotos} sets no staleTime, mobile's CloudPhotoViewer holds
     * them in component state - so nothing needs to survive longer.
     *
     * @return a signed URL, or the input unchanged if signing fails - the caller
     *         gets a link that 403s rather than an exception that blanks the
     *         whole gallery.
     */
    public String presignedUrl(String photoUrlOrName) {
        String objectName = extractObjectName(photoUrlOrName);
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectName)
                    .build();
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(PRESIGNED_URL_TTL)
                    .getObjectRequest(getRequest)
                    .build();
            return getPresigner().presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            log.error("Failed to presign object '{}' in bucket '{}'; returning the unsigned URL, "
                    + "which will not resolve", objectName, bucketName, e);
            return photoUrlOrName;
        }
    }

    /** {@link #presignedUrl(String)} over a list, preserving order. */
    public List<String> presignedUrls(List<String> photoUrlsOrNames) {
        return photoUrlsOrNames.stream().map(this::presignedUrl).toList();
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