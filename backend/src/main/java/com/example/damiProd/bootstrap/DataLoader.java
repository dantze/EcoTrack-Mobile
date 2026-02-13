package com.example.damiProd.bootstrap;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Product;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

@Component
public class DataLoader implements CommandLineRunner {

    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final ProductRepository productRepository;
    private final Environment environment;

    public DataLoader(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            ProductRepository productRepository,
            Environment environment) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
        this.productRepository = productRepository;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Check if running in production mode
        String[] activeProfiles = environment.getActiveProfiles();
        boolean isProduction = Arrays.asList(activeProfiles).contains("prod");

        if (isProduction) {
            System.out.println("Running in PRODUCTION mode - skipping test data seeding.");
            return;
        }

        System.out.println("Running in DEVELOPMENT mode - checking for seed data...");

        // Seed roles and employees if none exist
        if (employeeRepository.count() == 0) {
            loadRolesAndEmployees();
        }

        // Seed products if none exist
        if (productRepository.count() == 0) {
            loadProducts();
        }
    }

    private void loadRolesAndEmployees() {
        System.out.println("Seeding roles and employees...");

        // Create roles
        EmployeeRole driverRole = getOrCreateRole("DRIVER");
        EmployeeRole salesRole = getOrCreateRole("SALES");
        EmployeeRole techRole = getOrCreateRole("TECH");

        // ==================== TEHNIC (TECH) ====================
        createEmployee("ivan_sebastian", "tehnic1122", "Ivan Sebastian", null, null, techRole);
        createEmployee("stef_adrian", "tehnic3344", "Stef Adrian", null, null, techRole);
        // Note: Halalai Tudor has both TECH and SALES roles - added below

        // ==================== VANZARI (SALES) ====================
        createEmployee("cetean_narcis", "vanzari4413", "Cetean Narcis", null, null, salesRole);
        createEmployee("danila_gina", "vanzari5566", "Danila Gina", null, null, salesRole);
        createEmployee("cristea_calin", "vanzari7788", "Cristea Calin", null, null, salesRole);

        // Halalai Tudor - has both TECH and SALES roles
        Employee halalaiTudor = createEmployee("halalai_tudor", "tehnic133413", "Halalai Tudor", null, null, techRole);
        halalaiTudor.getRoles().add(salesRole);
        employeeRepository.save(halalaiTudor);

        // ==================== SOFERI (DRIVERS) ====================
        createEmployee("coman_teofil", "sofer23423", "Coman Teofil", null, null, driverRole);
        createEmployee("man_virgil", "sofer13555", "Man Virgil", null, null, driverRole);
        createEmployee("opric_ionut", "sofer38374", "Opric Ionut", null, null, driverRole);
        createEmployee("lodroman_ioan", "sofer99087", "Lodroman Ioan", null, null, driverRole);
        createEmployee("goarna_florin", "sofer56738", "Goarna Florin", null, null, driverRole);
        createEmployee("lapadat_aurel", "sofer10475", "Lapadat Aurel", null, null, driverRole);
        createEmployee("gavrilete_ioan", "sofer76543", "Gavrilete Ioan", null, null, driverRole);
        createEmployee("tripa_andrei", "sofer123452", "Tripa Andrei", null, null, driverRole);

        // ==================== ADMIN (optional - for testing) ====================
        Employee admin = createEmployee("admin1212345", "admin4893827878665", "Administrator", null, null, salesRole);
        admin.getRoles().add(techRole);
        admin.getRoles().add(driverRole);
        employeeRepository.save(admin);

        System.out.println("Seeded " + employeeRepository.count() + " employees with roles!");
    }

    private EmployeeRole getOrCreateRole(String roleName) {
        return employeeRoleRepository.findByRoleName(roleName)
                .orElseGet(() -> {
                    EmployeeRole role = new EmployeeRole(roleName);
                    return employeeRoleRepository.save(role);
                });
    }

    private Employee createEmployee(String username, String password, String fullName,
            String phone, String county, EmployeeRole role) {
        Employee employee = new Employee();
        employee.setUsername(username);
        employee.setPassword(password);
        employee.setFullName(fullName);
        employee.setPhone(phone);
        employee.setCounty(county);

        Employee saved = employeeRepository.save(employee);
        saved.getRoles().add(role);
        return employeeRepository.save(saved);
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
