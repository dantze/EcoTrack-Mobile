package com.example.damiProd.repository;

import com.example.damiProd.domain.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RouteRepository extends JpaRepository<Route, Long> {

    List<Route> findByEmployee_Id(Long employeeId);

    List<Route> findByCounty(String county);

    List<Route> findByEmployee_IdAndDate(Long employeeId, LocalDate date);

    Optional<Route> findByEmployee_IdAndDateAndCounty(Long employeeId, LocalDate date, String county);
}