package com.example.damiProd.domain;

public enum AccessRequestStatus {
    /** Waiting for an admin. Expires on its own if nobody decides in time. */
    PENDING,
    /** An admin granted a role. The device may now exchange its secret for tokens. */
    APPROVED,
    /** An admin refused. Terminal. */
    REJECTED,
    /** Nobody decided inside the window, or the approval was never claimed. Terminal. */
    EXPIRED,
    /** Tokens were issued. Terminal - a claim secret is single-use. */
    CLAIMED
}
