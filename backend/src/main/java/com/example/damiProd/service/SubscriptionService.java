package com.example.damiProd.service;

import com.example.damiProd.domain.IgienizareOrder;
import com.example.damiProd.domain.RecurringIgienizare;
import com.example.damiProd.domain.Subscription;
import com.example.damiProd.domain.Task;
import com.example.damiProd.domain.TaskStatus;
import com.example.damiProd.dto.SubscriptionUsageResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.OrderRepository;
import com.example.damiProd.repository.RecurringIgienizareRepository;
import com.example.damiProd.repository.SubscriptionRepository;
import com.example.damiProd.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final OrderRepository orderRepository;
    private final RecurringIgienizareRepository recurringRepository;
    private final TaskRepository taskRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               OrderRepository orderRepository,
                               RecurringIgienizareRepository recurringRepository,
                               TaskRepository taskRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.orderRepository = orderRepository;
        this.recurringRepository = recurringRepository;
        this.taskRepository = taskRepository;
    }

    /** Returns only active plans — used for frontend dropdowns */
    public List<Subscription> getActiveSubscriptions() {
        return subscriptionRepository.findByIsActiveTrue();
    }

    /** Returns all plans including retired ones — used for admin views */
    public List<Subscription> getAllSubscriptions() {
        return subscriptionRepository.findAll();
    }

    public Subscription getById(Long id) {
        return subscriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + id));
    }

    public Subscription save(Subscription subscription) {
        return subscriptionRepository.save(subscription);
    }

    public Subscription update(Long id, Subscription updated) {
        Subscription existing = getById(id);
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setType(updated.getType());
        existing.setPrice(updated.getPrice());
        existing.setVisitsPerMonth(updated.getVisitsPerMonth());
        existing.setDurationMonths(updated.getDurationMonths());
        existing.setIsIndefinite(updated.getIsIndefinite());
        existing.setIsActive(updated.getIsActive());
        return subscriptionRepository.save(existing);
    }

    /**
     * What is still holding this plan open. Advisory: the UI calls it to explain
     * a refusal before the operator commits, but deactivate() re-checks.
     */
    public SubscriptionUsageResponse usage(Long id) {
        getById(id); // 404 for an unknown plan, rather than a misleading empty answer
        return SubscriptionUsageResponse.of(
                orderRepository.findLiveBySubscriptionId(id),
                recurringRepository.findBySubscription_IdAndActiveTrue(id));
    }

    /**
     * Retires the plan — refused while anything live still points at it.
     *
     * The delete is a SOFT one (isActive = false), so orders already FINISHED on
     * this plan keep resolving through the surviving row and do not block. What
     * blocks is work that has not happened yet:
     *
     *   - Igienizare orders with no COMPLETED task, and
     *   - ACTIVE recurring plans, which would otherwise keep generating brand
     *     new orders against a retired plan every night.
     *
     * Deliberately NOT a bulk "move these to another plan" — that would be a
     * write the operator did not ask for. Refuse, name the blockers, and let
     * them be fulfilled, deleted or re-pointed one at a time.
     *
     * That is still true OF THIS METHOD. The bulk move now exists as
     * {@link #moveOrders} (TODO-37), reached by its own button in the refusal
     * dialog — asked for explicitly, on a list the operator has just read. What
     * was rejected was retiring a plan silently rewriting the orders on it, and
     * that has not changed: deactivate() still only ever refuses.
     */
    /*
     * Serialised against order creation with a row lock (TODO-39).
     *
     * The read of the blockers and the write of isActive have to be one atomic
     * decision. They were not: POST /api/orders could commit a live order for
     * this plan between them, and because that transaction never touches the
     * subscriptions row there was nothing to conflict on — no @Version, no lock,
     * no constraint — so the plan retired with live work pointing at it. The
     * damage is "live order on a retired plan" rather than a dangling FK, since
     * the delete is soft and the order still resolves.
     *
     * findByIdForUpdate takes SELECT … FOR UPDATE on the plan, and the two order
     * paths take the SAME lock before attaching an order to it, so the two can
     * no longer interleave: one of them sees the other's committed state and
     * refuses. @Transactional is what gives the lock a transaction to live in —
     * without it the lock would be released at the end of the SELECT, which is
     * before the check has even run.
     */
    @Transactional
    public void deactivate(Long id) {
        Subscription sub = subscriptionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + id));

        List<IgienizareOrder> liveOrders = orderRepository.findLiveBySubscriptionId(id);
        List<RecurringIgienizare> activePlans = recurringRepository.findBySubscription_IdAndActiveTrue(id);

        if (!liveOrders.isEmpty() || !activePlans.isEmpty()) {
            throw new IllegalStateException(blockedMessage(liveOrders.size(), activePlans.size()));
        }

        sub.setIsActive(false);
        subscriptionRepository.save(sub);
    }

    /**
     * Moves live Igienizare orders from one plan to another (TODO-37).
     *
     * This is the way out of a refused delete. TODO-20 names the blockers and
     * stops; {@code SubscriptionService.deactivate}'s javadoc records that a bulk
     * move was deliberately left out of THAT method, because retiring a plan must
     * not silently rewrite the orders on it. This is the same write asked for
     * explicitly, by its own button, on a list the operator has just read - which
     * is the difference.
     *
     * <strong>Only orders the caller named, and only ones still on the source
     * plan.</strong> The ids come from the refusal dialog the operator was just
     * looking at; anything else is a stale or hostile list and the whole call is
     * refused rather than partially applied. All-or-nothing matters here: a
     * half-moved set leaves the plan still un-retirable and the operator with no
     * idea which half went.
     *
     * <strong>Only LIVE orders can move.</strong> A finished order is history: it
     * records which plan the work was actually sold under, and re-pointing it
     * would rewrite that. They are also not blockers, so moving them buys
     * nothing. Note this is the STRICT fulfilment rule - the same
     * {@code NOT EXISTS (task COMPLETED)} as {@code findLiveBySubscriptionId} -
     * and it must stay that way, or this method and the guard it exists to
     * unblock would disagree about the same order.
     *
     * <strong>Tasks follow the order.</strong> {@code Task.productName} is a COPY
     * of the plan name taken when the task was generated, so a move that ignored
     * it would send a driver out with the old plan on their screen. Only tasks
     * that are not COMPLETED are touched - and by the rule above every task of a
     * movable order is one, so in practice all of them - because a completed
     * task is a record of what was done, not an instruction.
     *
     * Takes the TARGET plan's row lock and re-checks isActive, exactly like
     * {@code OrderService.createOrder} (TODO-39): this attaches work to a plan,
     * so it is one of the writes that races {@code deactivate}. The SOURCE is not
     * locked - emptying a plan can only ever help a concurrent retirement of it,
     * and taking both would invite a deadlock between two operators moving orders
     * in opposite directions.
     */
    @Transactional
    public int moveOrders(Long sourceId, Long targetId, List<Long> orderIds) {
        if (targetId == null || sourceId == null) {
            throw new IllegalStateException("Abonamentul sursă și cel destinație sunt obligatorii.");
        }
        if (targetId.equals(sourceId)) {
            throw new IllegalStateException("Comenzile sunt deja pe acest abonament.");
        }
        if (orderIds == null || orderIds.isEmpty()) {
            throw new IllegalStateException("Nu a fost selectată nicio comandă de mutat.");
        }

        Subscription source = getById(sourceId);
        // Lock + re-check under the lock, in that order. See TODO-39.
        Subscription target = subscriptionRepository.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found with id: " + targetId));
        requireUsablePlan(target, "pentru comenzi noi");

        // The live set is recomputed here rather than trusted from the client:
        // the dialog's list can be minutes old, and an order that has been
        // completed or already moved since must not be dragged along.
        Set<Long> movable = new LinkedHashSet<>();
        for (IgienizareOrder order : orderRepository.findLiveBySubscriptionId(sourceId)) {
            movable.add(order.getId());
        }

        List<Long> requested = new ArrayList<>(new LinkedHashSet<>(orderIds));
        List<Long> rejected = requested.stream().filter(id -> !movable.contains(id)).toList();
        if (!rejected.isEmpty()) {
            throw new IllegalStateException(
                    "Lista de comenzi nu mai este actuală: " + count(rejected.size(),
                            "comandă nu mai poate fi mutată", "comenzi nu mai pot fi mutate")
                            + " de pe abonamentul „" + source.getName()
                            + "”. Reîncarcă lista și încearcă din nou.");
        }

        int moved = 0;
        for (Long id : requested) {
            IgienizareOrder order = (IgienizareOrder) orderRepository.findById(id).orElseThrow(
                    () -> new ResourceNotFoundException("Order not found with id: " + id));
            order.setSubscription(target);
            orderRepository.save(order);

            for (Task task : taskRepository.findAllByOrder_IdOrderByIdAsc(id)) {
                if (task.getStatus() != TaskStatus.COMPLETED) {
                    task.setProductName(target.getName());
                    taskRepository.save(task);
                }
            }
            moved++;
        }
        return moved;
    }

    /**
     * A retired plan takes no new work. One implementation, three callers -
     * {@code OrderService.createOrder}/{@code updateOrder},
     * {@code RecurringIgienizareService.create} and {@link #moveOrders} - because
     * they are the same rule and a copy of it would drift.
     *
     * ALWAYS read under the plan's row lock (TODO-39); unlocked it answers about
     * a state that may already be gone. 409 rather than 404: the plan exists and
     * the caller is not confused about which one it means - it was retired while
     * they were filling the form in.
     *
     * {@code forWhat} completes "…nu mai poate fi folosit ___", so the refusal
     * says what was actually being attempted.
     */
    public static void requireUsablePlan(Subscription plan, String forWhat) {
        if (Boolean.FALSE.equals(plan.getIsActive())) {
            throw new IllegalStateException(
                    "Abonamentul „" + plan.getName() + "” a fost dezactivat și nu mai poate fi folosit "
                            + forWhat + ". Alege alt abonament.");
        }
    }

    /**
     * Romanian, and counted properly: "1 comandă" but "2 comenzi", and "de"
     * before the noun once the last two digits reach 20 ("24 de comenzi").
     */
    public static String blockedMessage(int orderCount, int planCount) {
        StringBuilder reason = new StringBuilder("Nu se poate șterge abonamentul: ");
        if (orderCount > 0) {
            reason.append(count(orderCount, "comandă nefinalizată", "comenzi nefinalizate"));
        }
        if (orderCount > 0 && planCount > 0) {
            reason.append(" și ");
        }
        if (planCount > 0) {
            reason.append(count(planCount, "plan recurent activ", "planuri recurente active"));
        }
        reason.append(orderCount + planCount == 1 ? " îl folosește încă." : " îl folosesc încă.");
        reason.append(" Finalizează sau șterge-le, ori mută-le pe alt abonament.");
        return reason.toString();
    }

    private static String count(int value, String singular, String plural) {
        if (value == 1) return "1 " + singular;
        int lastTwo = value % 100;
        boolean needsDe = lastTwo == 0 || lastTwo >= 20;
        return value + " " + (needsDe ? "de " : "") + plural;
    }
}
