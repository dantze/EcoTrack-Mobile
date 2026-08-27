package com.example.damiProd.exception;

import com.example.damiProd.service.InsufficientQuantityException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Every handler below answers with the same four keys. Clients parse that
     * shape, so a handler that drifts from it - a missing timestamp, a status in
     * the body that disagrees with the HTTP status - is a client-visible bug.
     * Building it in one place is what keeps them from drifting.
     */
    private static ResponseEntity<Map<String, Object>> body(HttpStatus status, String error, String message) {
        return ResponseEntity.status(status).body(payload(status.value(), error, message));
    }

    private static Map<String, Object> payload(int status, String error, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);
        return body;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }

        Map<String, Object> body = payload(HttpStatus.BAD_REQUEST.value(), "Validation Failed",
                "Request validation failed. Check field details.");
        body.put("details", fieldErrors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(InsufficientQuantityException.class)
    public ResponseEntity<Map<String, Object>> handleInsufficientQuantity(InsufficientQuantityException ex) {
        return body(HttpStatus.CONFLICT, "Insufficient Quantity", ex.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return body(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return body(HttpStatus.CONFLICT, "Conflict", ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "Payload Too Large",
                "File upload exceeds the maximum allowed size limit.");
    }

    // The exception's own message is deliberately not echoed for the two below:
    // it would tell an unauthorized caller which rule stopped them.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return body(HttpStatus.FORBIDDEN, "Forbidden", "Access denied: insufficient permissions.");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(AuthenticationException ex) {
        return body(HttpStatus.UNAUTHORIZED, "Unauthorized", "Authentication required or invalid credentials.");
    }

    /**
     * An unparseable request body is a 400, not a 500.
     *
     * Needs its own handler because HttpMessageNotReadableException is one of
     * the few Spring MVC exceptions that does NOT implement ErrorResponse, so
     * the check below cannot recover its status.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return body(HttpStatus.BAD_REQUEST, "Bad Request", "Malformed request body.");
    }

    /**
     * Last resort. Anything Spring MVC raised itself keeps its own status.
     *
     * Spring's own exceptions - unreadable request body, unsupported method,
     * missing parameter, wrong media type - all implement {@link ErrorResponse}
     * and already carry the right 4xx. Catching Exception without this check
     * flattened every one of them into a 500, so a malformed client request was
     * reported as a server fault: callers retried something that could never
     * succeed, and real 500s were indistinguishable from typos.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {
        if (ex instanceof ErrorResponse errorResponse) {
            HttpStatusCode status = errorResponse.getStatusCode();
            HttpStatus resolved = HttpStatus.resolve(status.value());
            return ResponseEntity.status(status).body(payload(status.value(),
                    resolved != null ? resolved.getReasonPhrase() : "Error",
                    "Request could not be processed."));
        }

        log.error("Unhandled exception caught in GlobalExceptionHandler", ex);

        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                "An unexpected error occurred. Please try again later.");
    }
}
