package com.example.damiProd.controller;

import com.example.damiProd.domain.Individual;
import com.example.damiProd.repository.IndividualRepository;
import com.example.damiProd.service.PhotoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Drain the ID photos EcoTrack used to store (TODO-14).
 *
 * <p><b>Why this endpoint exists at all, rather than a migration.</b> The
 * decision was to stop storing identity documents entirely, and the upload path
 * is already deleted. But the objects that path created are still in
 * DigitalOcean Spaces, and the only record of their keys is the
 * {@code individual.id_photo_url} column. Dropping the column in the same
 * change that stops writing it would strand every one of those objects
 * permanently: personal data left in a bucket with nothing left that knows it is
 * there. So the order is forced — <b>purge first, drop the column second</b>
 * (TODO-45) — and something has to run the purge against a live environment.
 *
 * <p>It is an endpoint and not a startup hook on purpose. Deleting production
 * data as a side effect of a deploy is not a thing that should happen because
 * somebody merged; an operator asks for it, sees the count, and can ask again.
 * {@code GET} is the preflight, {@code DELETE} is the act.
 *
 * <p>Authorization needs no new row in {@code SecurityConfig}: the path is under
 * {@code /api/admin/**}, which already resolves to ADMIN. No
 * {@code TaskAccessPolicy} call either — this is neither task-shaped nor
 * employee-scoped.
 *
 * <p><b>This class is temporary.</b> It is deleted together with the column it
 * exists to drain.
 */
@RestController
@RequestMapping("/api/admin/id-photos")
public class AdminIdPhotoController {

    private static final Logger log = LoggerFactory.getLogger(AdminIdPhotoController.class);

    private final IndividualRepository individualRepository;
    private final PhotoService photoService;

    public AdminIdPhotoController(IndividualRepository individualRepository, PhotoService photoService) {
        this.individualRepository = individualRepository;
        this.photoService = photoService;
    }

    /**
     * GET /api/admin/id-photos — how many legacy ID photos are still referenced.
     *
     * <p>Returns the count and the client ids, never the URLs. A URL here is an
     * unauthenticated link to a scan of someone's identity card, and the whole
     * point of this work is that such links stop being handed out.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> countRemaining() {
        List<Individual> remaining = individualRepository.findWithIdPhoto();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("remaining", remaining.size());
        body.put("clientIds", remaining.stream().map(Individual::getId).toList());
        return ResponseEntity.ok(body);
    }

    /**
     * DELETE /api/admin/id-photos — delete every stored ID photo, then forget it.
     *
     * <p>Per client: delete the object, then clear the column. <b>The column is
     * cleared only when the object is actually gone</b>, so a client whose delete
     * failed stays in the list and a second run retries it. Clearing regardless
     * would report success while leaving the object behind and destroying the
     * last reference to it — the exact outcome this endpoint exists to avoid.
     *
     * <p>A failure is reported, not thrown, for the same reason it is in
     * {@link PhotoService#deletePhoto} (TODO-25): aborting halfway through a bulk
     * purge leaves the operator with no way to finish it and no way to see how
     * far it got. The response carries both counts, so a partial run is visible
     * as a partial run.
     *
     * <p><b>Deliberately NOT {@code @Transactional}.</b> One transaction around
     * the whole loop would roll back every cleared column if the last row threw
     * — while the objects those columns pointed at are already deleted from
     * Spaces. Committing per row makes progress durable, so a purge that dies
     * halfway through has genuinely done half the work rather than none of it.
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> purge() {
        List<Individual> stored = individualRepository.findWithIdPhoto();
        List<Long> failed = new ArrayList<>();
        int deleted = 0;

        for (Individual individual : stored) {
            if (photoService.deletePhoto(individual.getIdPhotoUrl())) {
                individual.setIdPhotoUrl(null);
                individualRepository.save(individual);
                deleted++;
            } else {
                failed.add(individual.getId());
            }
        }

        if (failed.isEmpty()) {
            log.info("ID photo purge (TODO-14): {} deleted, none left behind", deleted);
        } else {
            log.error("ID photo purge (TODO-14): {} deleted, {} still in storage for clients {} — "
                    + "personal data remains in the bucket and these rows still reference it",
                    deleted, failed.size(), failed);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("deleted", deleted);
        body.put("failed", failed.size());
        body.put("failedClientIds", failed);
        body.put("message", failed.isEmpty()
                ? "Toate pozele de buletin au fost șterse."
                : "Unele poze de buletin nu au putut fi șterse. Reîncercați.");
        return ResponseEntity.ok(body);
    }
}
