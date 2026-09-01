package com.example.damiProd.repository;

import com.example.damiProd.domain.Individual;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * Individuals, for the one job {@link ClientRepository} cannot do: reach the
 * subclass column {@code id_photo_url}.
 *
 * <p>This exists only to drain the legacy ID photos (TODO-14) and goes away with
 * the column itself (TODO-45). Nothing else should acquire a dependency on it.
 */
public interface IndividualRepository extends JpaRepository<Individual, Long> {

    /**
     * Individuals that still point at a stored ID photo.
     *
     * <p>Both halves of the condition matter: the upload endpoint wrote a URL,
     * but a failed delete used to leave an empty string behind rather than null,
     * and an empty key would make the purge issue a delete for the bucket root.
     */
    @Query("SELECT i FROM Individual i WHERE i.idPhotoUrl IS NOT NULL AND i.idPhotoUrl <> ''")
    List<Individual> findWithIdPhoto();
}
