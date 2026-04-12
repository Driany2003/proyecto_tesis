package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.Authority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuthorityRepository extends JpaRepository<Authority, UUID> {
    Optional<Authority> findByUsernameIgnoreCase(String username);
    Optional<Authority> findByUser_Id(UUID userId);
}
