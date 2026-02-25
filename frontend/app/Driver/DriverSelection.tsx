import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { Employee, getAllDrivers } from '@/services/EmployeeService';
import { AuthService } from '@/services/AuthService';

const DriverSelection = () => {
    const router = useRouter();
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDrivers();
    }, []);

    const loadDrivers = async () => {
        try {
            const data = await getAllDrivers();
            setDrivers(data);
        } catch (error) {
            console.error('Error loading drivers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDriverSelect = async (driver: Employee) => {
        // Store the selected driver as the active driver
        await AuthService.setActiveDriver(driver.id, driver.fullName);
        // Navigate to DriverRoutes
        router.replace('/Driver/DriverRoutes');
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Se încarcă șoferii...</Text>
            </View>
        );
    }

    const handleGoBack = async () => {
        const user = await AuthService.getCurrentUser();
        if (user && user.roles.length > 1) {
            router.replace({
                pathname: '/RoleSelection',
                params: {
                    roles: user.roles.join(','),
                    fullName: user.fullName,
                },
            });
        } else {
            router.replace('/login');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Pressable onPress={handleGoBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <View>
                    <Text style={styles.headerText}>Selectează Șoferul</Text>
                    <Text style={styles.subHeaderText}>Vezi aplicația din perspectiva unui șofer</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {drivers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>Nu există șoferi înregistrați</Text>
                    </View>
                ) : (
                    drivers.map((driver) => (
                        <Pressable
                            key={driver.id}
                            style={({ pressed }) => [
                                styles.driverCard,
                                pressed && styles.cardPressed
                            ]}
                            onPress={() => handleDriverSelect(driver)}
                        >
                            <View style={styles.avatarContainer}>
                                <Ionicons name="person" size={28} color="#FFFFFF" />
                            </View>
                            <View style={styles.driverInfo}>
                                <Text style={styles.driverName}>{driver.fullName}</Text>
                                <Text style={styles.driverUsername}>@{driver.username}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="#5D8AA8" />
                        </Pressable>
                    ))
                )}
                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default DriverSelection;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#427992',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    subHeaderText: {
        color: '#5D8AA8',
        fontSize: 14,
        marginTop: 4,
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: '#5D8AA8',
        fontSize: 18,
        marginTop: 15,
    },
    driverCard: {
        backgroundColor: '#1E3A52',
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A4A65',
    },
    cardPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
        borderColor: '#4CAF50',
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#427992',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    driverCounty: {
        color: '#A5A5A5',
        fontSize: 13,
        marginBottom: 2,
    },
    driverUsername: {
        color: '#5D8AA8',
        fontSize: 12,
    },
});
