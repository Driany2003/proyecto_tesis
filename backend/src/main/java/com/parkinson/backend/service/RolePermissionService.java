package com.parkinson.backend.service;

import java.util.List;
import java.util.Map;

public interface RolePermissionService {

    Map<String, List<String>> getAllPermissionsByRole();

    void setPermission(String roleName, String sectionName, boolean enabled);

    boolean hasPermission(String roleName, String sectionName);

    List<String> getSections();
}
