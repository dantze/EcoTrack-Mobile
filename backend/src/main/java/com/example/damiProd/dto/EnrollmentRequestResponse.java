package com.example.damiProd.dto;

import java.time.Instant;

/**
 * Answer to a successful enrollment request.
 *
 * `claimSecret` is returned exactly once and never again - the server keeps only
 * its hash. The device must store it; losing it means starting over.
 */
public record EnrollmentRequestResponse(
        Long requestId,
        String claimSecret,
        String verificationCode,
        Instant expiresAt) {
}
