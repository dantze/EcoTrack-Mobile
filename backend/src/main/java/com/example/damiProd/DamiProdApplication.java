package com.example.damiProd;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

// UserDetailsServiceAutoConfiguration is excluded because auth here is entirely
// token-based (see config/SecurityConfig + config/BearerTokenAuthenticationFilter):
// nothing ever uses Spring Security's AuthenticationManager/UserDetailsService, so
// without this exclusion Boot auto-configures a pointless in-memory user and logs
// a "Using generated security password" line on every startup.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
public class DamiProdApplication {

	public static void main(String[] args) {
		SpringApplication.run(DamiProdApplication.class, args);
	}

	// There is deliberately no CommandLineRunner printing "Server started
	// successfully" any more (TODO-25). Boot already logs "Started
	// DamiProdApplication in Xs" through the same appender as everything else,
	// with a timing the print did not have.

}
