package com.parkinson.backend.security;

import com.parkinson.backend.model.entity.Authority;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + email));
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new UsernameNotFoundException("Usuario inactivo");
        }
        Authority authority = authorityRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new UsernameNotFoundException("Authority no encontrada"));
        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().getName().toUpperCase())
        );
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                authority.getPasswordHash(),
                authorities
        );
    }
}
