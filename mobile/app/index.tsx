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
 */

type Gate = { kind: 'loading' } | { kind: 'redirect'; href: string };

export default function Index() {
    const [gate, setGate] = useState<Gate>({ kind: 'loading' });

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const [hasSession, user] = await Promise.all([
                    AuthService.hasStoredSession(),
                    AuthService.getCurrentUser(),
                ]);
                if (!active) return;

                if (!hasSession || !user) {
                    setGate({ kind: 'redirect', href: '/enrollment' });
                    return;
                }

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
