package com.example.damiProd.repository;

import com.example.damiProd.domain.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface RouteRepository extends JpaRepository<Route, Long> {

    List<Route> findByEmployee_Id(Long employeeId);

    List<Route> findByEmployee_IdAndDayOfWeek(Long employeeId, Integer dayOfWeek);
}