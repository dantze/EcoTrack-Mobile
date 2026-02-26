import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { Employee, getAllDrivers } from '@/services/EmployeeService';
import { AuthService } from '@/services/AuthService';
import ScreenHeader from '../../components/ScreenHeader';
import { AppColors } from '../../constants/Colors';

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
        await AuthService.setActiveDriver(driver.id, driver.fullName);
        router.replace('/Driver/DriverRoutes');
    };

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

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
                <Text style={styles.loadingText}>Se încarcă șoferii...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScreenHeader title="Selectează Șoferul" onBack={handleGoBack} />
            <Text style={styles.subHeaderText}>Vezi aplicația din perspectiva unui șofer</Text>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {drivers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={60} color={AppColors.accentColor} />
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
                                <Ionicons name="person" size={28} color={AppColors.textWhite} />
                            </View>
                            <View style={styles.driverInfo}>
                                <Text style={styles.driverName}>{driver.fullName}</Text>
                                <Text style={styles.driverUsername}>@{driver.username}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={AppColors.accentColor} />
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
        backgroundColor: AppColors.screenBackground,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },
    subHeaderText: {
        color: AppColors.accentColor,
        fontSize: 14,
        marginTop: -10,
        marginBottom: 10,
        paddingHorizontal: 75,
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
        color: AppColors.accentColor,
        fontSize: 18,
        marginTop: 15,
    },
    driverCard: {
        backgroundColor: AppColors.modalBackground,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: AppColors.inputBackground,
    },
    cardPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
        borderColor: AppColors.successGreen,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: AppColors.buttonBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        color: AppColors.textWhite,
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    driverUsername: {
        color: AppColors.accentColor,
        fontSize: 12,
    },
});
