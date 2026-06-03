package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {

    List<RolePermission> findAllByRole_NameIgnoreCaseOrderBySectionNameAsc(String roleName);

    List<RolePermission> findAllByOrderByRole_NameAscSectionNameAsc();

    Optional<RolePermission> findByRole_NameIgnoreCaseAndSectionName(String roleName, String sectionName);

    boolean existsByRole_NameIgnoreCaseAndSectionNameAndEnabledTrue(String roleName, String sectionName);
}
