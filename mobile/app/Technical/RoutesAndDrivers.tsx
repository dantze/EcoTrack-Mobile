import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getAllDrivers, Employee } from '../../services/EmployeeService'
import ScreenHeader from '../../components/layout/ScreenHeader';
import { AppColors } from '../../constants/Colors';

const RoutesAndDrivers = () => {
    const router = useRouter();

    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadDrivers();
    }, []);

    const loadDrivers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAllDrivers();
            setDrivers(data);
        } catch (err) {
            setError('Nu s-au putut încărca șoferii');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDriverPress = (driver: Employee) => {
        router.push({
            pathname: '/Technical/DriverRoutesList',
            params: {
                driverId: driver.id.toString(),
                driverName: driver.fullName,
            },
        });
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Șoferi" />

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={AppColors.buttonBackground} />
                    <Text style={styles.loadingText}>Se încarcă șoferii...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={loadDrivers}>
                        <Text style={styles.retryButtonText}>Încearcă din nou</Text>
                    </Pressable>
                </View>
            ) : drivers.length === 0 ? (
                <View style={styles.centerContent}>
                    <Text style={styles.emptyText}>Nu există șoferi în baza de date</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {drivers.map((driver) => (
                        <Pressable
                            key={driver.id}
                            style={({ pressed }) => [
                                styles.driverButton,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={() => handleDriverPress(driver)}
                        >
                            <Text style={styles.driverName}>{driver.fullName}</Text>
                            <Text style={styles.driverPhone}>{driver.phone || 'Fără telefon'}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </View>
    )
}

export default RoutesAndDrivers
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: AppColors.subtitleText,
        fontSize: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: AppColors.buttonBackground,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    retryButtonText: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 12,
    },
    driverButton: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 15,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    driverName: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
    driverPhone: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
})
