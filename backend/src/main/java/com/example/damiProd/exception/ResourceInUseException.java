package com.example.damiProd.exception;

import com.example.damiProd.dto.BlockingOrderRef;

import java.util.List;

/**
 * A delete (or soft-delete) was refused because live records still reference
 * the resource.
 *
 * Extends {@link IllegalStateException} on purpose: the codebase already maps
 * that to 409 Conflict in {@link GlobalExceptionHandler}, so the status stays
 * the same whichever handler wins. The dedicated handler exists only to attach
 * {@link #getBlockingOrders()} to the response body — this is one mechanism
 * with a richer payload, not a second mechanism.
 */
public class ResourceInUseException extends IllegalStateException {

    private final transient List<BlockingOrderRef> blockingOrders;

    public ResourceInUseException(String message, List<BlockingOrderRef> blockingOrders) {
        super(message);
        this.blockingOrders = List.copyOf(blockingOrders);
    }

    public List<BlockingOrderRef> getBlockingOrders() {
        return blockingOrders;
    }
}
