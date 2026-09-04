package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.AdminController;
import com.example.damiProd.dto.CreateEmployeeRequest;
import com.example.damiProd.dto.EmployeeResponse;
import com.example.damiProd.service.AdminService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * {@code AdminController} answers in the API's ONE error envelope (TODO-76).
 *
 * <p>This controller used to hand-roll three shapes between four methods: a
 * bare 404 with no body, a 200 carrying an English {@code {"message": ...}} that
 * nothing read, and a 400 {@code {"error": ...}} with no {@code message} key at
 * all. Everything else in the API answers with
 * {@code {timestamp, status, error, message}} from {@code GlobalExceptionHandler}.
 *
 * <p><strong>The 400 is the case that mattered.</strong> Since TODO-51 the web
 * app shows the server's own Romanian sentence by reading {@code .message}, so
 * a body keyed {@code error} produced null and the admin was told "Cererea a
 * eșuat (cod 400)" instead of which username was taken. The mirror of this test
 * is `web/src/api/__tests__/serverMessage.test.ts`, which pins the same two
 * shapes from the client's side.
 *
 * <p>A {@code @WebMvcTest} slice is the right level here and a limited one:
 * {@code @ControllerAdvice} IS picked up, so the envelope under test is the
 * real one — but {@code SecurityConfig} is not, so this says nothing about who
 * may call these endpoints. That is {@code SecurityTests/AuthorizationMatrixTest}'s
 * job and it already covers them.
 */
@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerTest {

    private static final String TAKEN =
            "Există deja un angajat cu numele de utilizator „ion.popescu”.";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminService adminService;

    private static String createBody() {
        return """
                {"username":"ion.popescu","fullName":"Ion Popescu","phone":"0711000000","roles":["DRIVER"]}
                """;
    }

    // ── The refusal the web app has to be able to show ──────────────────────

    @Test
    @DisplayName("a duplicate username answers 400 in the standard envelope, with the reason in `message`")
    void duplicateUsernameUsesTheStandardEnvelope() throws Exception {
        when(adminService.createEmployee(any(CreateEmployeeRequest.class)))
                .thenThrow(new IllegalArgumentException(TAKEN));

        mockMvc.perform(post("/api/admin/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody()))
                .andExpect(status().isBadRequest())
                // `message` is the key `serverMessage` reads. The old body had
                // the sentence under `error` instead, which is why it vanished.
                .andExpect(jsonPath("$.message").value(TAKEN))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("a 409 from the last-admin guard stays a 409")
    void lastAdminGuardIsNotDowngraded() throws Exception {
        // The old `catch (RuntimeException)` was wider than it looked: it would
        // have flattened this IllegalStateException into a 400 with the wrong
        // shape. Nothing in createEmployee throws it today, which is exactly
        // why the over-broad catch was easy to leave in place.
        when(adminService.createEmployee(any(CreateEmployeeRequest.class)))
                .thenThrow(new IllegalStateException("Nu se poate șterge ultimul administrator."));

        mockMvc.perform(post("/api/admin/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Nu se poate șterge ultimul administrator."));
    }

    @Test
    @DisplayName("a successful create still answers 201 with the employee")
    void createStillReturns201() throws Exception {
        EmployeeResponse created = new EmployeeResponse();
        created.setId(7L);
        created.setUsername("ion.popescu");
        when(adminService.createEmployee(any(CreateEmployeeRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/admin/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.username").value("ion.popescu"));
    }

    // ── The 404s, which used to have no body at all ─────────────────────────

    @Test
    @DisplayName("an unknown employee answers 404 WITH a Romanian message")
    void getUnknownEmployeeHasABody() throws Exception {
        when(adminService.getEmployeeById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/admin/employees/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Angajatul nu a fost găsit"))
                .andExpect(jsonPath("$.error").value("Not Found"));
    }

    @Test
    @DisplayName("updating an unknown employee answers 404 with the same message")
    void updateUnknownEmployeeHasABody() throws Exception {
        when(adminService.updateEmployee(eq(99L), any(CreateEmployeeRequest.class)))
                .thenReturn(Optional.empty());

        mockMvc.perform(put("/api/admin/employees/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Angajatul nu a fost găsit"));
    }

    @Test
    @DisplayName("deleting an unknown employee answers 404 with a message")
    void deleteUnknownEmployeeHasABody() throws Exception {
        when(adminService.deleteEmployee(99L)).thenReturn(false);

        mockMvc.perform(delete("/api/admin/employees/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Angajatul nu a fost găsit"));
    }

    // ── The delete that used to answer 200 with English prose ───────────────

    @Test
    @DisplayName("a successful delete answers 204 with no body")
    void deleteReturnsNoContent() throws Exception {
        when(adminService.deleteEmployee(7L)).thenReturn(true);

        mockMvc.perform(delete("/api/admin/employees/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    // ── Roles: the same two shapes lived in one method ──────────────────────

    @Test
    @DisplayName("a missing role name answers 400 in the standard envelope")
    void missingRoleNameUsesTheStandardEnvelope() throws Exception {
        mockMvc.perform(post("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Numele rolului este obligatoriu."));
    }

    @Test
    @DisplayName("a blank role name is refused too, not just a missing one")
    void blankRoleNameIsRefused() throws Exception {
        mockMvc.perform(post("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleName\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Numele rolului este obligatoriu."));
    }

    @Test
    @DisplayName("a duplicate role answers 400 with the service's own sentence")
    void duplicateRoleUsesTheStandardEnvelope() throws Exception {
        when(adminService.createRole("DRIVER"))
                .thenThrow(new IllegalArgumentException("Rolul „DRIVER” există deja."));

        mockMvc.perform(post("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleName\":\"DRIVER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Rolul „DRIVER” există deja."));
    }
}
