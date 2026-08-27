/**
 * Auth module barrel. Everything outside `src/auth/` imports through here.
 */

export { AuthProvider, useAuth } from './AuthProvider';
export type { AuthOutcome, AuthStatus } from './AuthProvider';
export { RequireAuth, RequireRole } from './RequireAuth';
export {
  readOrCreateDeviceId,
  readPendingTicket,
  savePendingTicket,
  clearPendingTicket,
} from './storage';
