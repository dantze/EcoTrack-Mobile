package com.example.damiProd.repository;

import com.example.damiProd.domain.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByUsername(String username);

    Optional<Employee> findByEmailIgnoreCase(String email);

    /**
     * How many employees hold a given role. Used by the last-admin lockout
     * guard in AdminService, which is why it is COUNT(DISTINCT e): roles is a
     * ManyToMany, so a plain COUNT over the join would count an employee once
     * per matching row and could report two admins where there is one.
     */
    @Query("SELECT COUNT(DISTINCT e) FROM Employee e JOIN e.roles r WHERE r.roleName = :roleName")
    long countByRoleName(@Param("roleName") String roleName);
}
