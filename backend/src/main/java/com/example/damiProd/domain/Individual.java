package com.example.damiProd.domain;

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

    // idPhotoUrl lived here. EcoTrack stopped storing photographs of identity
    // documents (TODO-14) - the client apps read the card on the operator's own
    // device, take the name and CNP from its machine-readable zone and drop the
    // image (TODO-13) - and the field outlived that only as the record of the
    // keys of objects already in Spaces, so they could be found and deleted.
    // That drain is confirmed done and the field is gone with it (TODO-45).
    //
    // The database column is NOT dropped by this: ddl-auto=update never drops
    // anything, so it sits in H2 and in Postgres like the orphaned
    // intake_message / order_draft tables. DEPLOYMENT.md has the manual DDL.

    public Individual() {
    }

    public Individual(String email, String phone, String address, String fullName, String CNP) {
        super(email, phone, address);
        this.fullName = fullName;
        this.CNP = CNP;
    }

}
