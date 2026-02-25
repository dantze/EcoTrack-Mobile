import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Employee } from '../services/EmployeeService';
import { AppColors } from '../constants/Colors';

interface DriverSelectModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    drivers: Employee[];
    loading?: boolean;
    onSelectDriver: (driver: Employee) => void;
}

const DriverSelectModal: React.FC<DriverSelectModalProps> = ({
    visible,
    onClose,
    title = 'Selectează Șofer',
    subtitle,
    drivers,
    loading = false,
    onSelectDriver,
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{title}</Text>
                        <Pressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={AppColors.textWhite} />
                        </Pressable>
                    </View>

                    {subtitle && (
                        <Text style={styles.modalSubtitle}>{subtitle}</Text>
                    )}

                    {loading ? (
                        <ActivityIndicator size="large" color={AppColors.textWhite} style={{ marginTop: 20 }} />
                    ) : drivers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="person-outline" size={40} color={AppColors.accentColor} />
                            <Text style={styles.emptyText}>Nu există șoferi disponibili</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.modalList}>
                            {drivers.map((driver) => (
                                <Pressable
                                    key={driver.id}
                                    style={({ pressed }) => [
                                        styles.driverItem,
                                        pressed && styles.driverItemPressed,
                                    ]}
                                    onPress={() => onSelectDriver(driver)}
                                >
                                    <Ionicons name="person-circle-outline" size={32} color={AppColors.textWhite} />
                                    <View style={styles.driverInfo}>
                                        <Text style={styles.driverName}>{driver.fullName}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={AppColors.accentColor} />
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default DriverSelectModal;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: AppColors.modalOverlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        backgroundColor: AppColors.modalBackground,
        borderRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        color: AppColors.textWhite,
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalSubtitle: {
        color: AppColors.subtitleText,
        fontSize: 14,
        marginBottom: 15,
    },
    modalList: {
        marginTop: 10,
    },
    driverItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    driverItemPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    driverInfo: {
        flex: 1,
        marginLeft: 12,
    },
    driverName: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 30,
        paddingBottom: 20,
    },
    emptyText: {
        color: AppColors.accentColor,
        fontSize: 18,
        marginTop: 15,
    },
});
