package com.parkinson.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "T_role_permissions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"role_id", "section_name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private java.util.UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false, foreignKey = @ForeignKey(name = "fk_role_permission_role"))
    private Role role;

    @Column(name = "section_name", nullable = false, length = 50)
    private String sectionName;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = false;
}
