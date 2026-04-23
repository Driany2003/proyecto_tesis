package com.parkinson.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@ConfigurationPropertiesScan("com.parkinson.backend.config")
public class ParkinsonApplication {

    public static void main(String[] args) {
        SpringApplication.run(ParkinsonApplication.class, args);
    }
}
