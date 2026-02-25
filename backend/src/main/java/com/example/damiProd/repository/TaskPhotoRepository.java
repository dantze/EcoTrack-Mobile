package com.example.damiProd.repository;

import com.example.damiProd.domain.TaskPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskPhotoRepository extends JpaRepository<TaskPhoto, Long> {
    List<TaskPhoto> findByTaskId(Long taskId);
}
