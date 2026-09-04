package com.example.damiProd.bootstrap;

import com.example.damiProd.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gives a number to orders written before orders had numbers (TODO-70).
 *
 * <p>{@code Order.number} is a primitive {@code long}, so every order created
 * before TODO-69 assigned one was persisted as 0. Those rows render as
 * <em>"#0"</em> on Comenzi — all of them, indistinguishable from each other —
 * and turn {@code findLiveBySubscriptionId}'s {@code ORDER BY o.number ASC}
 * into an arbitrary ordering over a column of zeroes.
 *
 * <p><strong>Why this is code and not a SQL snippet in the runbook.</strong>
 * TODO-70 asked where such a statement is supposed to live, because this repo
 * has no migration tool — {@code ddl-auto=update} creates and alters, and
 * nothing carries data fixes. The options were a documented manual
 * {@code UPDATE}, or this. A manual statement has to be remembered, per
 * environment, by whoever happens to deploy — and the H2 file on a developer's
 * machine would never get it, so "#0" would keep reappearing locally long after
 * production was fixed. Running it at boot means no environment can be missed
 * and none can drift back.
 *
 * <p><strong>Why it is safe to run on every boot.</strong> The statement is
 * {@code WHERE number = 0}, so it is idempotent: a second run matches nothing,
 * and a row that already has a number is never rewritten. On a database with no
 * zeroes it is one no-op UPDATE against a small table. It logs only when it
 * actually changed something, so a healthy boot stays quiet.
 *
 * <p><strong>It restates OrderService's rule, it does not invent one.</strong>
 * New orders get {@code number = id} there; these get {@code number = id} here.
 * The two must move together — see the comment on
 * {@link OrderRepository#backfillMissingOrderNumbers()}.
 *
 * <p>Ordered after {@link DataLoader} so a fresh database is seeded first. That
 * ordering does not currently matter — DataLoader seeds no orders — but the two
 * runners touching the same database in an undefined order is the kind of thing
 * that only becomes a bug once somebody adds a seeded order.
 */
@Component
@Order(100)
public class OrderNumberBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(OrderNumberBackfill.class);

    private final OrderRepository orderRepository;

    public OrderNumberBackfill(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int fixed = orderRepository.backfillMissingOrderNumbers();
        if (fixed > 0) {
            log.info("Backfilled {} order number(s) that were 0 (TODO-70)", fixed);
        }
    }
}
