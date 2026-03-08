package com.example.damiProd;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DamiProdApplication {

	public static void main(String[] args) {
		SpringApplication.run(DamiProdApplication.class, args);
	}

	@Bean
	CommandLineRunner run() {
		return args -> {
			System.out.println("Server started successfully");
		};
	}

}
