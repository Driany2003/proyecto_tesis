package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.CreateUserDto;
import com.parkinson.backend.model.dto.request.UpdateUserDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.service.UserService;
import com.parkinson.backend.util.WebUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public List<UserDto> findAll() {
        return userService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> findById(@PathVariable UUID id) {
        return ResponseEntity.of(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserDto> create(
            @Valid @RequestBody CreateUserDto dto,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        String clientIp = WebUtils.getClientIp(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(dto, email, clientIp));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserDto dto,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        String clientIp = WebUtils.getClientIp(request);
        return ResponseEntity.ok(userService.update(id, dto, email, clientIp));
    }
}
