package com.example.damiProd.service.intake;

import com.example.damiProd.domain.IntakeMessage;
import com.example.damiProd.domain.OrderDraft;
import com.example.damiProd.repository.ClientRepository;
import com.example.damiProd.repository.IntakeMessageRepository;
import com.example.damiProd.repository.OrderDraftRepository;
import com.example.damiProd.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Receives inbound messages and turns them into reviewable drafts.
 *
 * The pipeline is: store the message verbatim -> extract (model or heuristic)
 * -> resolve against real clients and products -> persist a PENDING draft.
 * A person then accepts or rejects it. Nothing here creates an Order.
 *
 * Extraction happens off the request path in every real deployment — a mail
 * poller or webhook calls {@link #receive} and returns immediately, and the
 * draft appears a few seconds later. Even so, a provider outage cannot fail
 * the caller: {@link OrderDraftExtractor} never throws, and a message that
 * produces nothing usable still becomes a draft, flagged for a human. Losing an
 * order because a model was down is not an acceptable failure mode; making
 * someone type it in is.
 */
@Service
public class IntakeService {

    private static final Logger log = LoggerFactory.getLogger(IntakeService.class);

    private final IntakeMessageRepository messages;
    private final OrderDraftRepository drafts;
    private final ClientRepository clients;
    private final ProductRepository products;
    private final OrderDraftExtractor extractor;
    private final DraftResolver resolver = new DraftResolver();
    private final Clock clock;

    public IntakeService(IntakeMessageRepository messages, OrderDraftRepository drafts,
            ClientRepository clients, ProductRepository products,
            OrderDraftExtractor extractor, Clock clock) {
        this.messages = messages;
        this.drafts = drafts;
        this.clients = clients;
        this.products = products;
        this.extractor = extractor;
        this.clock = clock;
    }

    /** Stores a message and produces a draft from it. */
    @Transactional
    public OrderDraft receive(IntakeMessage message) {
        IntakeMessage saved = messages.save(message);
        return extractFor(saved);
    }

    @Transactional
    public OrderDraft extractFor(IntakeMessage message) {
        List<String> catalogue = products.findAll().stream()
                .map(product -> product.getName())
                .filter(name -> name != null && !name.isBlank())
                .toList();

        // Only the message text and the catalogue cross the network. No client
        // record is sent — Individual.CNP is a national ID and the extraction
        // task has no use for it. See OrderDraftExtractor's contract.
        ExtractedOrder extracted = extractor.extract(message.getBody(), catalogue);

        OrderDraft draft = resolver.resolve(extracted, clients.findAll(), products.findAll(),
                LocalDate.now(clock));
        draft.setMessage(message);
        draft.setProvider(extractor.providerName());

        message.setStatus(extracted.confidence() != null && extracted.confidence() > 0
                ? IntakeMessage.Status.EXTRACTED
                : IntakeMessage.Status.FAILED);
        message.setProcessedAt(Instant.now(clock));
        messages.save(message);

        OrderDraft persisted = drafts.save(draft);
        log.info("Draft {} created from message {} via {} (confidence={})",
                persisted.getId(), message.getId(), draft.getProvider(), draft.getConfidence());
        return persisted;
    }

    public List<OrderDraft> pending() {
        return drafts.findByStatusWithMessage(OrderDraft.Status.PENDING);
    }

    public long pendingCount() {
        return drafts.countByStatus(OrderDraft.Status.PENDING);
    }

    /**
     * Marks a draft as handled.
     *
     * Deliberately does NOT create the Order itself. The review screen sends the
     * operator into the existing order form, pre-filled from the draft, so an
     * accepted draft goes through exactly the same validation, the same
     * availability checks and the same code path as an order typed by hand.
     * A second creation path that skipped OrderService would drift from it
     * within a release.
     */
    @Transactional
    public OrderDraft markAccepted(Long draftId, Long createdOrderId) {
        OrderDraft draft = drafts.findById(draftId)
                .orElseThrow(() -> new IllegalArgumentException("Ciorna nu a fost găsită"));
        if (draft.getStatus() != OrderDraft.Status.PENDING) {
            throw new IllegalStateException("Ciorna a fost deja procesată");
        }
        draft.setStatus(OrderDraft.Status.ACCEPTED);
        draft.setCreatedOrderId(createdOrderId);
        draft.setReviewedAt(Instant.now(clock));
        return drafts.save(draft);
    }

    @Transactional
    public OrderDraft reject(Long draftId) {
        OrderDraft draft = drafts.findById(draftId)
                .orElseThrow(() -> new IllegalArgumentException("Ciorna nu a fost găsită"));
        draft.setStatus(OrderDraft.Status.REJECTED);
        draft.setReviewedAt(Instant.now(clock));
        return drafts.save(draft);
    }
}
