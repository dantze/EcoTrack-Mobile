// ─── Task Type Labels & Colors ────────────────────────────────────────────────

export const TASK_TYPE_LABELS: Record<string, string> = {
    PLACEMENT: 'Amplasare',
    PICKUP: 'Ridicare',
    SANITIZATION: 'Igienizare',
    MAINTENANCE: 'Mentenanță',
};

export const TASK_TYPE_COLORS: Record<string, string> = {
    PLACEMENT: '#2ECC71',
    PICKUP: '#E74C3C',
    SANITIZATION: '#3498DB',
    MAINTENANCE: '#F39C12',
};

export const getTaskTypeLabel = (type?: string): string =>
    TASK_TYPE_LABELS[type?.toUpperCase() || ''] || type || 'Sarcină';

export const getTaskTypeColor = (type?: string): string =>
    TASK_TYPE_COLORS[type?.toUpperCase() || ''] || '#9B59B6';

// ─── Task Status Labels & Colors ──────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
    NEW: 'Nou',
    IN_PROGRESS: 'În progres',
    COMPLETED: 'Finalizat',
    CANCELLED: 'Anulat',
};

export const STATUS_COLORS: Record<string, string> = {
    NEW: '#3498DB',
    IN_PROGRESS: '#F1C40F',
    COMPLETED: '#2ECC71',
    CANCELLED: '#E74C3C',
};

export const getStatusLabel = (status?: string): string =>
    STATUS_LABELS[status?.toUpperCase() || ''] || status || 'Necunoscut';

export const getStatusColor = (status?: string): string =>
    STATUS_COLORS[status?.toUpperCase() || ''] || '#95A5A6';
