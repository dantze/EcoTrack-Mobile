package com.example.damiProd.ControllerTests;

import com.example.damiProd.controller.AdminIdPhotoController;
import com.example.damiProd.domain.Individual;
import com.example.damiProd.repository.IndividualRepository;
import com.example.damiProd.service.PhotoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The one-time legacy ID-photo purge (TODO-14).
 *
 * A {@code @WebMvcTest} slice proves nothing about who may call this - see
 * {@code AuthorizationMatrixTest.onlyAdmin_mayPurgeLegacyIdPhotos} for that.
 * What it proves is the part that would quietly ruin the purge: the coupling
 * between deleting the object and clearing the column.
 */
@WebMvcTest(AdminIdPhotoController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminIdPhotoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IndividualRepository individualRepository;

    @MockitoBean
    private PhotoService photoService;

    private static Individual withPhoto(long id, String url) {
        Individual individual = new Individual("a@b.ro", "0700", "Str. 1", "Ion Pop", "1900101123456");
        individual.setId(id);
        individual.setIdPhotoUrl(url);
        return individual;
    }

    @Test
    void get_reportsHowManyRemain_withoutHandingOutTheUrls() throws Exception {
        when(individualRepository.findWithIdPhoto())
                .thenReturn(List.of(withPhoto(7L, "https://cdn.example/a.jpg")));

        String body = mockMvc.perform(get("/api/admin/id-photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remaining").value(1))
                .andExpect(jsonPath("$.clientIds[0]").value(7))
                .andReturn().getResponse().getContentAsString();

        // The whole reason this endpoint returns ids rather than URLs: a URL is
        // an unauthenticated link to a scan of someone's identity card.
        assertThat(body).doesNotContain("cdn.example");
    }

    @Test
    void delete_removesTheObjectThenClearsTheColumn() throws Exception {
        Individual individual = withPhoto(7L, "https://cdn.example/a.jpg");
        when(individualRepository.findWithIdPhoto()).thenReturn(List.of(individual));
        when(photoService.deletePhoto(anyString())).thenReturn(true);

        mockMvc.perform(delete("/api/admin/id-photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(1))
                .andExpect(jsonPath("$.failed").value(0));

        verify(photoService).deletePhoto("https://cdn.example/a.jpg");
        assertThat(individual.getIdPhotoUrl()).isNull();
    }

    /**
     * The failure mode this endpoint exists to avoid.
     *
     * <p>If the column were cleared regardless of whether the object went, a
     * failed delete would report success AND destroy the last record of the
     * object's key - leaving a scan of someone's ID in the bucket that nothing
     * can ever find again. So a failed delete must keep the URL, so the next run
     * retries it.
     */
    @Test
    void delete_keepsTheUrlWhenTheObjectCouldNotBeDeleted() throws Exception {
        Individual individual = withPhoto(7L, "https://cdn.example/a.jpg");
        when(individualRepository.findWithIdPhoto()).thenReturn(List.of(individual));
        when(photoService.deletePhoto(anyString())).thenReturn(false);

        mockMvc.perform(delete("/api/admin/id-photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(0))
                .andExpect(jsonPath("$.failed").value(1))
                .andExpect(jsonPath("$.failedClientIds[0]").value(7));

        assertThat(individual.getIdPhotoUrl()).isEqualTo("https://cdn.example/a.jpg");
        verify(individualRepository, never()).save(individual);
    }

    @Test
    void delete_onAnAlreadyDrainedEnvironment_isANoOp() throws Exception {
        when(individualRepository.findWithIdPhoto()).thenReturn(List.of());

        mockMvc.perform(delete("/api/admin/id-photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(0))
                .andExpect(jsonPath("$.failed").value(0));

        verify(photoService, never()).deletePhoto(anyString());
    }
}
