package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.authority ORDER BY u.email")
    List<User> findAllWithAuthority();

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.authority WHERE u.id = :id")
    Optional<User> findByIdWithAuthority(UUID id);
}
