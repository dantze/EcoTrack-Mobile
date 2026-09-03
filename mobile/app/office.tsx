import { Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/AuthService';
import { roleLabel } from '../services/roleRouting';
import { API_BASE_URL } from '../constants/ApiConfig';
import { AppColors } from '../constants/Colors';

/**
 * Where an office-only employee lands (TODO-33).
 *
 * Vânzări and Tehnic were deleted from this app: the order types, the client
 * forms and the dispatch board were written twice, and the web versions are
 * the complete ones. Office staff use the responsive web app — on this same
 * phone, in a browser — and this screen is the signpost.
 *
 * It exists because the alternative is worse in a specific way. For these
 * roles `destinationForRoles` reports `kind: 'office'` rather than
 * `kind: 'none'`, and 'none'
 * drops the session: a salesperson would be sent back to enrollment on every
 * launch, needing an admin to approve them each time, only to be told again
 * that there is nothing here. The session is valid and is kept — the roles may
 * change tomorrow, and then the boot gate routes them into the driver screens
 * with no re-enrollment.
 *
 * Deconectare is still offered, because a shared phone has to be releasable.
 */

/**
 * The web app is the same deployment as the API — Caddy serves the SPA and
 * proxies `/api` to the backend on one domain — so its address is the API base
 * with the `/api` suffix taken off. One configured URL rather than two that
 * can drift apart.
 *
 * A build that never set `EXPO_PUBLIC_API_BASE_URL` falls back to the old bare
 * IP (see constants/ApiConfig.ts), and stripping `/api` from that names the
 * backend rather than the SPA. The URL is printed under the button for exactly
 * that reason: it is a signpost, so a wrong one is readable and correctable
 * rather than a dead end. New builds set the variable to the HTTPS domain.
 */
const webAppUrl = (): string => API_BASE_URL.replace(/\/api\/?$/, '');

export default function OfficeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const roles = typeof params.roles === 'string' ? params.roles.split(',').filter(Boolean) : [];
    const fullName = (params.fullName as string) || 'Utilizator';

    const handleLogout = async () => {
        await AuthService.logout();
        router.replace('/enrollment');
    };

    const url = webAppUrl();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Ionicons name="laptop-outline" size={40} color={AppColors.linkBlue} />
                </View>

                <Text style={styles.greeting}>Bună, {fullName.split(' ')[0]}!</Text>
                <Text style={styles.roles}>
                    Rol: {roles.map((role) => roleLabel(role)).join(', ') || 'necunoscut'}
                </Text>

                <Text style={styles.body}>
                    Vânzările și partea tehnică se folosesc din aplicația web, care merge și pe
                    telefon. Aplicația mobilă a rămas doar pentru șoferi.
                </Text>

                <Pressable
                    style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                    onPress={() => void Linking.openURL(url)}
                >
                    <Ionicons name="open-outline" size={20} color={AppColors.textWhite} />
                    <Text style={styles.linkText}>Deschide aplicația web</Text>
                </Pressable>

                <Text style={styles.url}>{url}</Text>
            </View>

            <View style={styles.footer}>
                <Pressable style={styles.logoutButton} onPress={() => void handleLogout()}>
                    <Ionicons name="log-out-outline" size={20} color={AppColors.errorRed} />
                    <Text style={styles.logoutText}>Deconectare</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: AppColors.modalBackground,
        borderRadius: 16,
        padding: 24,
        gap: 12,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: AppColors.inputBackground,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: AppColors.textWhite,
    },
    roles: {
        fontSize: 14,
        color: AppColors.subtitleText,
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        color: AppColors.lightText,
    },
    linkButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 12,
        paddingVertical: 14,
    },
    pressed: {
        opacity: 0.8,
    },
    linkText: {
        fontSize: 16,
        fontWeight: '600',
        color: AppColors.textWhite,
    },
    url: {
        fontSize: 12,
        textAlign: 'center',
        color: AppColors.mutedText,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    logoutText: {
        fontSize: 16,
        color: AppColors.errorRed,
    },
});
