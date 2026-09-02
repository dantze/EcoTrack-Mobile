/**
 * Rendered by `RequireRole` (src/auth/RequireAuth.tsx) when a signed-in user's
 * roles do not cover the route they landed on — e.g. a Sales-only account
 * opening /rute directly. Distinct from NotFoundPage: the route exists, the
 * account just cannot see it.
 *
 * The way out is deliberately NOT "/": `HomeRedirect` renders this very screen
 * for an account with neither SALES nor TECH, so a link home would be a loop.
 * `StatusScreen` resolves it from the roles the account actually holds.
 */

import { ShieldOff } from 'lucide-react';
import { StatusScreen } from './StatusScreen';

export function ForbiddenPage() {
  return (
    <StatusScreen
      icon={<ShieldOff aria-hidden />}
      title="Acces interzis"
      body="Contul tău nu are rolul necesar pentru această secțiune. Dacă ai nevoie de acces, cere-i unui administrator să ți-l acorde din Angajați."
    />
  );
}
