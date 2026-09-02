package com.example.damiProd.service;

import com.example.damiProd.domain.Product;
import com.example.damiProd.dto.ProductUsageResponse;
import com.example.damiProd.exception.ResourceNotFoundException;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    public ProductService(ProductRepository productRepository, OrderRepository orderRepository) {
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
    }

    /** The catalogue anyone picking a product should see: retired ones excluded. */
    public List<Product> getAllProducts() {
        return productRepository.findAllUsable();
    }

    /** Everything, retired included — for a management view that must show history. */
    public List<Product> getEveryProduct() {
        return productRepository.findAll();
    }

    public Product saveProduct(Product product) {
        return productRepository.save(product);
    }

    /**
     * What is still holding this product in the catalogue (TODO-57).
     *
     * Advisory, and the exact counterpart of {@code SubscriptionService.usage}:
     * the UI calls it to name the blockers before the operator commits to a
     * delete, and {@link #deleteProduct} re-checks. The two answers come from
     * the same predicate - {@code findLiveByProductId} is the listed form of the
     * {@code countLiveByProductId} the delete counts - so the dialog can never
     * name a different set of orders from the one the refusal counted.
     */
    public ProductUsageResponse usage(Long id) {
        // 404 for an unknown product, rather than a misleading "nothing uses it".
        productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
        return ProductUsageResponse.of(orderRepository.findLiveByProductId(id));
    }

    /**
     * Retires the product — refused while UNFINISHED orders still use it.
     *
     * <strong>This used to be a hard delete, and the rule had to change with
     * it</strong> (TODO-38). A hard delete leaves nothing behind for an old
     * order to resolve through, so it had to block on ANY referencing order,
     * finished or not — which meant a product sold once, years ago, could never
     * leave the catalogue. That is the actual complaint: the list only ever grows.
     *
     * Now `isActive = false` and the row survives, exactly like
     * {@code SubscriptionService.deactivate}. A finished order keeps resolving
     * its product name and price through it and therefore does not block; only
     * work that has not happened yet does. The two are the same rule and the
     * same {@code NOT EXISTS (task COMPLETED)} definition of finished — see the
     * "Two definitions of done" section in CLAUDE.md, and do not swap in the
     * lenient date-based one here.
     *
     * Both order types that carry a product are counted. Ridicari were missed
     * originally: a product used only by a pickup order could be destroyed, and
     * the order was left pointing at a row that no longer existed.
     */
    @Transactional
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));

        long live = orderRepository.countLiveByProductId(id);
        if (live > 0) {
            throw new IllegalStateException(blockedMessage(live));
        }

        // Soft delete. Idempotent: retiring an already-retired product is a
        // no-op rather than an error, because the caller got what they asked for.
        product.setIsActive(false);
        productRepository.save(product);
    }

    /**
     * Romanian, counted the same way as SubscriptionService.blockedMessage():
     * "1 comandă" but "2 comenzi", and "de" before the noun once the last two
     * digits reach 20 ("24 de comenzi").
     */
    public static String blockedMessage(long orderCount) {
        String noun;
        if (orderCount == 1) {
            noun = "1 comandă nefinalizată îl folosește încă";
        } else {
            long lastTwo = orderCount % 100;
            String de = (lastTwo == 0 || lastTwo >= 20) ? "de " : "";
            noun = orderCount + " " + de + "comenzi nefinalizate îl folosesc încă";
        }
        return "Nu se poate șterge produsul: " + noun
                + ". Finalizează sau șterge comenzile, apoi încearcă din nou.";
    }
}
