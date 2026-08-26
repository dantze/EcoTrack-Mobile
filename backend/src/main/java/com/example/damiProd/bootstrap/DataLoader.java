package com.example.damiProd.bootstrap;

import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Product;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the role rows and the product catalogue into an empty database.
 *
 * It no longer seeds employees, and the committed dev passwords it used to
 * carry are gone with them: there are no passwords anywhere in this system.
 * The first person to enroll on a fresh database becomes ADMIN - see
 * EnrollmentService - and every account after that exists because that admin
 * approved a device.
 */
@Component
public class DataLoader implements CommandLineRunner {

        private final EmployeeRepository employeeRepository;
        private final EmployeeRoleRepository employeeRoleRepository;
        private final ProductRepository productRepository;

        public DataLoader(EmployeeRepository employeeRepository,
                        EmployeeRoleRepository employeeRoleRepository,
                        ProductRepository productRepository) {
                this.employeeRepository = employeeRepository;
                this.employeeRoleRepository = employeeRoleRepository;
                this.productRepository = productRepository;
        }

        @Override
        @Transactional
        public void run(String... args) throws Exception {
                System.out.println("Checking for seed data...");

                if (employeeRoleRepository.count() == 0) {
                        loadRoles();
                }

                // Seed products only if none exist
                if (productRepository.count() == 0) {
                        loadProducts();
                }
        }

        /**
         * Roles only. Employees are NOT seeded any more and must not be: an
         * account now exists only because an admin approved a specific device
         * (see EnrollmentService), and there is no password for a seeded row to
         * carry. Seeding one would also silently consume the first-run bootstrap,
         * since that triggers on an empty employees table.
         */
        private void loadRoles() {
                System.out.println("Seeding roles...");
                getOrCreateRole("DRIVER");
                getOrCreateRole("SALES");
                getOrCreateRole("TECH");
                getOrCreateRole("ADMIN");
        }

        private EmployeeRole getOrCreateRole(String roleName) {
                return employeeRoleRepository.findByRoleName(roleName)
                                .orElseGet(() -> {
                                        EmployeeRole role = new EmployeeRole(roleName);
                                        return employeeRoleRepository.save(role);
                                });
        }

        private void loadProducts() {
                System.out.println("Seeding products...");

                // Toaletă Armal
                productRepository.save(new Product(
                                "Toaletă Armal",
                                "Include vas toaletă, pişoar, suport hârtie igienică și cuier. Opțional, poate fi dotată cu lampă led. Are o capacitate de 210 litri (420 utilizări) și o greutate de 76 kg.",
                                850.00));

                // Toaletă Armal cu lavoar
                productRepository.save(new Product(
                                "Toaletă Armal cu lavoar",
                                "Ideală pentru utilizare în locații fără acces la rețele de apă. Pe lângă dotările standard (vas toaletă, pişoar, suport hârtie, cuier), include un lavoar de 38 litri. Opțional, se poate adăuga lampă led și dozator de săpun.",
                                1150.00));

                // Toaletă Armal pentru persoane cu dizabilități
                productRepository.save(new Product(
                                "Toaletă Armal pentru persoane cu dizabilități",
                                "Este ușor accesibilă, având un spațiu interior generos pentru manevrarea căruciorului. Include bare de sprijin, vas toaletă și suport hârtie igienică. Opțional, poate fi dotată cu lavoar de 38 litri, lampă led și dozator de săpun.",
                                1350.00));

                // Toaletă Armal Racordabilă / Flush
                productRepository.save(new Product(
                                "Toaletă Armal Racordabilă / Flush",
                                "Disponibilă în două variante: Armal racordabil (conectată la rețeaua de apă și canalizare, utilizări nelimitate) și Armal flush (sistem de spălare manuală cu pompă de picior și rezervor de apă de 40 litri). Ambele includ vas toaletă, suport hârtie și cuier.",
                                1450.00));

                // Armal cabină de duş
                productRepository.save(new Product(
                                "Armal cabină de duş",
                                "Dotată cu podea anti-alunecare, duză pentru duş detaşabilă, supapă separată pentru apă caldă/rece și cuier. Necesită racordarea la rețeaua de apă și canalizare.",
                                1250.00));

                // Panouri gard mobil TLC - Gard mare
                productRepository.save(new Product(
                                "Panouri gard mobil TLC - Gard mare",
                                "Realizate din oțel zincat, cu ramă metalică durabilă, fiind ușor și rapid de montat. Poate utiliza cleme metalice pentru o fixare sigură.",
                                180.00));

                // Panouri gard mobil TLC - Gard mic
                productRepository.save(new Product(
                                "Panouri gard mobil TLC - Gard mic",
                                "Realizate din oțel zincat, cu ramă metalică durabilă, fiind ușor și rapid de montat. Are picioare de sprijin incorporate pentru stabilitate ridicată.",
                                120.00));

                // Pişoar GLO:PEE
                productRepository.save(new Product(
                                "Pişoar GLO:PEE",
                                "Design inovator care permite utilizarea de către 4 persoane simultan, oferind suporturi pentru sticle/pahare. Este realizat dintr-un material rezistent la UV și are o capacitate de 400 litri (800 utilizări).",
                                650.00));

                // Toaletă T-Blue Star
                productRepository.save(new Product(
                                "Toaletă T-Blue Star",
                                "Model de toaletă montabilă/demontabilă, ideală pentru locuri înguste. Include vas toaletă, pişoar, suport hârtie și cuier. Opțional, permite instalarea unui lavoar de 60 litri, lampă led și dozator de săpun.",
                                950.00));

                // Lavoar exterior - Armal Aqua Pop
                productRepository.save(new Product(
                                "Lavoar exterior Armal Aqua Pop",
                                "Unitate care nu necesită acces la rețeaua de apă, dotată cu rezervoare pentru apă curată și apă uzată, dozator de săpun și dispenser de prosoape.",
                                550.00));

                // Lavoar exterior - Global Duo
                productRepository.save(new Product(
                                "Lavoar exterior Global Duo",
                                "Unitate care nu necesită acces la rețeaua de apă, dotată cu rezervoare pentru apă curată și apă uzată, dozator de săpun și dispenser de prosoape. Include 2 chiuvete și o capacitate mai mare (1000 utilizări).",
                                780.00));

                System.out.println("Seeded " + productRepository.count() + " products!");
        }
}
