package com.example.damiProd.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    private String fullName;
    private String phone;
    private String county;

    // Nullable, unique: only set for employees provisioned for Google sign-in.
    // Plain employees (mobile app, username/password only) leave this null.
    @Column(unique = true)
    private String email;

    // Google's stable "sub" claim, captured on the employee's first successful
    // Google login. Once set, later logins must match it even if the email
    // column changes later - see AuthService#loginWithGoogle.
    @Column(name = "google_sub", unique = true)
    @JsonIgnore
    private String googleSub;

    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "employees_roles_join",
        joinColumns = @JoinColumn(name = "employee_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<EmployeeRole> roles = new HashSet<>();

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Route> routes = new ArrayList<>();

    // --- Constructori ---
    public Employee() {}

    public Employee(String username, String password, String fullName, String phone) {
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.phone = phone;
    }

    // --- Getters și Setters ---
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getCounty() {
        return county;
    }

    public void setCounty(String county) {
        this.county = county;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getGoogleSub() {
        return googleSub;
    }

    public void setGoogleSub(String googleSub) {
        this.googleSub = googleSub;
    }

    public Set<EmployeeRole> getRoles() {
        return roles;
    }

    public void setRoles(Set<EmployeeRole> roles) {
        this.roles = roles;
    }

    public List<Route> getRoutes() {
        return routes;
    }

    public void setRoutes(List<Route> routes) {
        this.routes = routes;
    }
}