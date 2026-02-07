package com.example.damiProd.bootstrap;

import com.example.damiProd.domain.Employee;
import com.example.damiProd.domain.EmployeeRole;
import com.example.damiProd.repository.EmployeeRepository;
import com.example.damiProd.repository.EmployeeRoleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

@Component
public class DataLoader implements CommandLineRunner {

    private final EmployeeRepository employeeRepository;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final Environment environment;

    public DataLoader(EmployeeRepository employeeRepository,
            EmployeeRoleRepository employeeRoleRepository,
            Environment environment) {
        this.employeeRepository = employeeRepository;
        this.employeeRoleRepository = employeeRoleRepository;
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

        // Seed roles and employees if none exist (only in non-production)
        if (employeeRepository.count() == 0) {
            System.out.println("Running in DEVELOPMENT mode - seeding test data...");
            loadRolesAndEmployees();
        }
    }

    private void loadRolesAndEmployees() {
        System.out.println("Seeding roles and employees...");

        // Create roles
        EmployeeRole driverRole = getOrCreateRole("DRIVER");
        EmployeeRole salesRole = getOrCreateRole("SALES");
        EmployeeRole techRole = getOrCreateRole("TECH");

        // Create sample employees
        // Driver 1 - Ion (Arad)
        createEmployee("ion", "driver123", "Ion Popescu", "0721000001", "Arad", driverRole);

        // Driver 2 - Gheorghe (Cluj)
        createEmployee("gheorghe", "driver123", "Gheorghe Marin", "0721000002", "Cluj", driverRole);

        // Sales - Maria
        createEmployee("maria", "sales123", "Maria Ionescu", "0722000001", null, salesRole);

        // Tech - Andrei
        createEmployee("andrei", "tech123", "Andrei Popa", "0723000001", null, techRole);

        // Admin (has both SALES and TECH access)
        Employee admin = createEmployee("admin", "admin123", "Administrator", "0720000000", null, salesRole);
        admin.getRoles().add(techRole);
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
}
