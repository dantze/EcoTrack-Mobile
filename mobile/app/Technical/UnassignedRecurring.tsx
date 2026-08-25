import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import React, { useState, useCallback } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/Colors';
import { RecurringIgienizareService } from '../../services/RecurringIgienizareService';
import ScreenHeader from '../../components/layout/ScreenHeader';

interface RecurringPlan {
    id: number;
    client: {
        id: number;
        name?: string;
        fullName?: string;
        email?: string;
        phone?: string;
    };
    subscription?: {
        id: number;
        name: string;
    };
    frequencyDays: number;
    startDate: string;
    endDate: string;
    isIndefinite: boolean;
    sanitationLocationAddress?: string;
    active: boolean;
}

const getFrequencyLabel = (days: number): string => {
    switch (days) {
        case 7: return 'Săptămânal';
        case 14: return 'Bisăptămânal';
        case 21: return 'La 3 săptămâni';
        case 30: return 'Lunar';
        default: return `La ${days} zile`;
    }
};

const getClientName = (plan: RecurringPlan): string => {
    if (plan.client?.name) return plan.client.name;
    if (plan.client?.fullName) return plan.client.fullName;
    return 'Client necunoscut';
};

const UnassignedRecurring = () => {
    const { routeId, routeName } = useLocalSearchParams<{
        routeId?: string;
        routeName?: string;
    }>();

    const [plans, setPlans] = useState<RecurringPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            fetchUnassigned();
        }, [])
    );

    const fetchUnassigned = async () => {
        try {
            setLoading(true);
            const data = await RecurringIgienizareService.getUnassigned();
            setPlans(data);
        } catch (error) {
            console.error('Error fetching unassigned plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = (plan: RecurringPlan) => {
        if (!routeId) return;

        Alert.alert(
            'Asignare pe rută',
            `Asignezi igienizarea recurentă pentru "${getClientName(plan)}" pe ruta "${routeName || `#${routeId}`}"?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Asignează',
                    onPress: async () => {
                        try {
                            setAssigning(plan.id);
                            await RecurringIgienizareService.assignRoute(plan.id, Number(routeId));
                            Alert.alert('Succes', 'Igienizarea recurentă a fost asignată și sarcinile au fost generate!');
                            // Remove from list
                            setPlans(prev => prev.filter(p => p.id !== plan.id));
                        } catch (error) {
                            console.error('Error assigning plan:', error);
                            Alert.alert('Eroare', 'Nu s-a putut asigna igienizarea recurentă.');
                        } finally {
                            setAssigning(null);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Igienizări Recurente" />

            <Text style={styles.subtitle}>
                Neasignate — apasă pentru a adăuga pe ruta {routeName || `#${routeId}`}
            </Text>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={AppColors.textWhite} />
                    <Text style={styles.loadingText}>Se încarcă...</Text>
                </View>
            ) : plans.length === 0 ? (
                <View style={styles.centerContent}>
                    <Ionicons name="checkmark-circle-outline" size={60} color="#5D8AA8" />
                    <Text style={styles.emptyText}>Nu există igienizări recurente neasignate</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {plans.map((plan) => (
                        <Pressable
                            key={plan.id}
                            style={({ pressed }) => [
                                styles.card,
                                pressed && styles.cardPressed,
                                assigning === plan.id && styles.cardAssigning,
                            ]}
                            onPress={() => handleAssign(plan)}
                            disabled={assigning !== null}
                        >
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="repeat" size={20} color="#3498DB" style={{ marginRight: 8 }} />
                                    <Text style={styles.clientName}>{getClientName(plan)}</Text>
                                </View>

                                {plan.subscription && (
                                    <Text style={styles.detailText}>
                                        Abonament: {plan.subscription.name}
                                    </Text>
                                )}

                                <Text style={styles.detailText}>
                                    Frecvență: {getFrequencyLabel(plan.frequencyDays)}
                                </Text>

                                <Text style={styles.detailText}>
                                    Început: {plan.startDate}
                                    {plan.isIndefinite ? ' — Nedeterminat' : ` — Sfârșit: ${plan.endDate}`}
                                </Text>

                                {plan.sanitationLocationAddress && (
                                    <View style={styles.addressRow}>
                                        <Ionicons name="location-outline" size={14} color="#E0E0E0" style={{ marginRight: 5 }} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {plan.sanitationLocationAddress}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.assignIcon}>
                                {assigning === plan.id ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="add-circle" size={32} color={AppColors.successGreen} />
                                )}
                            </View>
                        </Pressable>
                    ))}
                    <View style={{ height: 20 }} />
                </ScrollView>
            )}
        </View>
    );
};

export default UnassignedRecurring;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    subtitle: {
        color: AppColors.subtitleText,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 15,
        paddingHorizontal: 20,
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
    emptyText: {
        color: '#5D8AA8',
        fontSize: 18,
        marginTop: 15,
        textAlign: 'center',
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    card: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        borderLeftWidth: 4,
        borderLeftColor: '#3498DB',
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardAssigning: {
        opacity: 0.6,
    },
    cardContent: {
        flex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    clientName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: AppColors.textWhite,
        flex: 1,
    },
    detailText: {
        fontSize: 13,
        color: '#E0E0E0',
        marginBottom: 3,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    assignIcon: {
        paddingLeft: 12,
    },
});
