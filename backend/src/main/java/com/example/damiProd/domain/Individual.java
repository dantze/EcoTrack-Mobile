package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Table;

@Entity
@Getter
@Setter
@Table(name = "individual")
public class Individual extends Client {

    private String fullName;

    private String CNP;

    /**
     * Legacy column. <b>Nothing writes this any more (TODO-14).</b>
     *
     * <p>EcoTrack no longer stores a photograph of anyone's identity document.
     * The client apps read the card on the operator's own device, extract the
     * name and CNP from its machine-readable zone and drop the image (TODO-13),
     * so there is no upload endpoint left to set this field — {@code
     * PhotosController} and both {@code /{clientId}/idPhoto} routes are gone.
     *
     * <p>The column survives for exactly one reason: <b>the objects it points at
     * are still in DigitalOcean Spaces</b>, and this is the only remaining
     * record of their keys. Deleting the field before deleting the objects would
     * strand every one of them permanently — an ID photo nobody can find and
     * nobody can remove. {@code DELETE /api/admin/id-photos} is the one-time
     * purge; once it reports zero remaining on every environment, the field and
     * its column can go. That follow-up is TODO-45.
     *
     * <p>{@code @JsonIgnore} because it must never cross the wire again. Those
     * objects were uploaded with a PUBLIC_READ ACL, so the value is a working,
     * unauthenticated URL to a scan of someone's identity card; serialising it
     * to every caller of {@code GET /api/clients} is how it leaked in the first
     * place.
     */
    @JsonIgnore
    private String idPhotoUrl;

    public Individual() {
    }

    public Individual(String email, String phone, String address, String fullName, String CNP) {
        super(email, phone, address);
        this.fullName = fullName;
        this.CNP = CNP;
    }

}
