import { StyleSheet, Text, View, Pressable, StatusBar } from 'react-native';
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { Ionicons } from '@expo/vector-icons';

const ROLE_CONFIG = {
    DRIVER: {
        title: 'Șofer',
        subtitle: 'Rute și livrări',
        icon: 'car-outline' as const,
        route: '/Driver/DriverSelection',
        color: '#4CAF50',
    },
    SALES: {
        title: 'Vânzări',
        subtitle: 'Comenzi și clienți',
        icon: 'cart-outline' as const,
        route: '/Sales/Menu',
        color: '#2196F3',
    },
    TECH: {
        title: 'Tehnic',
        subtitle: 'Intervenții și service',
        icon: 'construct-outline' as const,
        route: '/Technical/Menu',
        color: '#FF9800',
    },
    // ADMIN has no screens of its own here — administration is a web job. What
    // an admin holding the phone wants is to look at a driver's day, which is
    // what DriverSelection does. Without this row an ADMIN+DRIVER account
    // (the first person to enroll, most likely) would see a one-card picker.
    ADMIN: {
        title: 'Administrator',
        subtitle: 'Rutele oricărui șofer',
        icon: 'shield-checkmark-outline' as const,
        route: '/Driver/DriverSelection',
        color: '#9C27B0',
    },
};

type RoleKey = keyof typeof ROLE_CONFIG;

const RoleSelection = () => {
    const router = useRouter();

    // Revokes the session server-side before leaving the screen; navigating
    // away on its own left this device's refresh token valid for 60 more days.
    const handleLogout = async () => {
        await AuthService.logout();
        router.replace('/enrollment');
    };
    const params = useLocalSearchParams();

    // Get roles from params (passed as comma-separated string)
    const rolesParam = params.roles as string;
    const fullName = params.fullName as string || 'Utilizator';
    const userRoles: RoleKey[] = rolesParam ? rolesParam.split(',') as RoleKey[] : [];

    const handleRoleSelect = (role: RoleKey) => {
        const config = ROLE_CONFIG[role];
        if (config) {
            router.push(config.route as any);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <Text style={styles.greeting}>Bună, {fullName.split(' ')[0]}!</Text>
                <Text style={styles.subtitle}>Alege rolul pentru această sesiune</Text>
            </View>

            <View style={styles.rolesContainer}>
                {userRoles.map((role) => {
                    const config = ROLE_CONFIG[role];
                    if (!config) return null;

                    return (
                        <Pressable
                            key={role}
                            style={({ pressed }) => [
                                styles.roleCard,
                                { borderLeftColor: config.color },
                                pressed && styles.roleCardPressed,
                            ]}
                            onPress={() => handleRoleSelect(role)}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
                                <Ionicons name={config.icon} size={32} color={config.color} />
                            </View>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>{config.title}</Text>
                                <Text style={styles.roleSubtitle}>{config.subtitle}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="#A5A5A5" />
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.footer}>
                <Pressable
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={20} color="#FF5252" />
                    <Text style={styles.logoutText}>Deconectare</Text>
                </Pressable>
            </View>
        </View>
    );
};

export default RoleSelection;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
        paddingHorizontal: 20,
        paddingTop: 80,
    },
    header: {
        marginBottom: 40,
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#A5A5A5',
    },
    rolesContainer: {
        gap: 16,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E3A52',
        borderRadius: 16,
        padding: 20,
        borderLeftWidth: 4,
        gap: 16,
    },
    roleCardPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleInfo: {
        flex: 1,
    },
    roleTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    roleSubtitle: {
        fontSize: 14,
        color: '#A5A5A5',
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
        color: '#FF5252',
    },
});
