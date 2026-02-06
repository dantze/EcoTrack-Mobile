package com.example.damiProd.bootstrap;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.domain.Product;
import com.example.damiProd.domain.Route;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import com.example.damiProd.repository.ProductRepository;
import com.example.damiProd.repository.RouteRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
public class DataLoader implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final RouteRepository routeRepository;

    public DataLoader(ProductRepository productRepository,
            EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            RouteRepository routeRepository) {
        this.productRepository = productRepository;
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
        this.routeRepository = routeRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // if (productRepository.count() == 0) {
        // loadProducts();
        // }

        // Load test driver and route for Arad county
        // loadTestDriverAndRoute();
    }

    private void loadProducts() {
        for (int i = 1; i <= 12; i++) {
            Product product = new Product(
                    "Pachet servicii " + i,
                    "Description for packet " + i,
                    (double) ((i * 50) + 100));
            productRepository.save(product);
        }
        System.out.println("Loaded 12 Service Packets");
    }

    private void loadTestDriverAndRoute() {
        // Check if test driver already exists
        if (employeeRepository.findByUsername("sofer_arad").isEmpty()) {
            // Get or create DRIVER role - ensure it's managed in this transaction
            EmployeeRole driverRole = employeeRoleRepository.findByRoleName("DRIVER")
                    .orElseGet(() -> {
                        EmployeeRole role = new EmployeeRole();
                        role.setRoleName("DRIVER");
                        return employeeRoleRepository.save(role);
                    });

            // Create test driver for Arad - save first without role
            Employee driver = new Employee();
            driver.setUsername("sofer_arad");
            driver.setPassword("password123");
            driver.setFullName("Ion Popescu (Arad)");
            driver.setPhone("0721000001");
            driver.setCounty("Arad");

            // Save employee first
            Employee savedDriver = employeeRepository.save(driver);

            // Then add role and save again
            savedDriver.getRoles().add(driverRole);
            savedDriver = employeeRepository.save(savedDriver);

            System.out.println("Created test driver for Arad: " + savedDriver.getFullName());

            // Create test route for Arad
            Route route = new Route();
            route.setDate(LocalDate.now());
            route.setEmployee(savedDriver);
            route.setCounty("Arad");

            routeRepository.save(route);
            System.out.println("Created test route for Arad county");
        }
    }
}
