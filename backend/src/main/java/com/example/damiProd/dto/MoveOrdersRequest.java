package com.example.damiProd.dto;

import java.util.List;

/**
 * Body of POST /api/subscriptions/{id}/orders/move (TODO-37).
 *
 * `orderIds` is required and is not a convenience: the move applies to exactly
 * the orders the operator was shown in the refusal dialog, never to "everything
 * currently on the plan". Between the dialog opening and the button being
 * pressed a new order can land on the source plan, and sweeping it along would
 * be a write nobody asked for - the same objection that kept a bulk move out of
 * `deactivate` in the first place.
 */
public class MoveOrdersRequest {

    private Long targetSubscriptionId;
    private List<Long> orderIds;

    public Long getTargetSubscriptionId() {
        return targetSubscriptionId;
    }

    public void setTargetSubscriptionId(Long targetSubscriptionId) {
        this.targetSubscriptionId = targetSubscriptionId;
    }

    public List<Long> getOrderIds() {
        return orderIds;
    }

    public void setOrderIds(List<Long> orderIds) {
        this.orderIds = orderIds;
    }
}
