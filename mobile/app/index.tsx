import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { destinationForRoles } from '../services/roleRouting';
import { AppColors } from '../constants/Colors';

/**
 * The boot gate.
 *
 * This screen used to redirect to /login unconditionally, which was harmless
 * when logging in meant typing a password. It is not harmless now: under
 * enrollment, "start again" means filing a fresh access request and waiting for
 * an admin to approve it, so every app restart would need a human. A stored
 * session has to be restored instead.
 *
 * The refresh token is what proves there is a session — the access token
 * expires every 30 minutes and `apiFetch` renews it silently.
 *
 * It is also where the cached user is brought back up to date (TODO-35). The
 * stored `user.roles` decides which menus this device draws, and it used to be
 * written once, at claim time, and never again — so an admin changing someone's
 * role in Angajați left the phone rendering menus the backend would refuse. The
 * gate now re-reads the employee from `GET /api/auth/me` and routes on THAT,
 * falling back to the cached copy when the call cannot be made: a phone with no
 * signal must not be sent back to enrollment, and the refresh token still says
 * the session is good.
 */

type Gate = { kind: 'loading' } | { kind: 'redirect'; href: string };

export default function Index() {
    const [gate, setGate] = useState<Gate>({ kind: 'loading' });

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const [hasSession, cached] = await Promise.all([
                    AuthService.hasStoredSession(),
                    AuthService.getCurrentUser(),
                ]);
                if (!active) return;

                if (!hasSession || !cached) {
                    setGate({ kind: 'redirect', href: '/enrollment' });
                    return;
                }

                // Fresh roles win; a failed call leaves the cached ones, which
                // are still the roles this device was last told it had.
                const synced = await AuthService.syncCurrentUser();
                if (!active) return;
                const user = synced?.user ?? cached;

                const destination = destinationForRoles(user.roles);
                if (destination.kind === 'screen') {
                    setGate({ kind: 'redirect', href: destination.path });
                } else if (destination.kind === 'roleSelection') {
                    // Params are simple enough to encode in the href, which keeps
                    // this component a plain <Redirect> in every branch.
                    const params = new URLSearchParams({
                        roles: destination.roles.join(','),
                        fullName: user.fullName,
                    });
                    setGate({ kind: 'redirect', href: `/RoleSelection?${params.toString()}` });
                } else if (destination.kind === 'office') {
                    // SALES / TECH and nothing else. A real session for a real
                    // employee whose screens now live on the web (TODO-33), so
                    // it is KEPT: dropping it would loop them through an
                    // admin-approved enrollment on every launch to be told the
                    // same thing, and it would cost them their place the day
                    // they are also made a driver.
                    const params = new URLSearchParams({
                        roles: destination.roles.join(','),
                        fullName: user.fullName,
                    });
                    setGate({ kind: 'redirect', href: `/office?${params.toString()}` });
                } else {
                    // A stored session with no role this app can open is not a
                    // session worth keeping.
                    await AuthService.forgetSession();
                    if (active) setGate({ kind: 'redirect', href: '/enrollment' });
                }
            } catch (error) {
                console.error('Could not restore the session:', error);
                if (active) setGate({ kind: 'redirect', href: '/enrollment' });
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    if (gate.kind === 'loading') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
            </View>
        );
    }

    return <Redirect href={gate.href as never} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: AppColors.screenBackground,
    },
});
