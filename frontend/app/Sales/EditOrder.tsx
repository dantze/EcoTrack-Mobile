import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { OrderService } from '../../services/OrderService';
import PrimaryButton from '../../components/forms/PrimaryButton';
import ScreenHeader from '../../components/layout/ScreenHeader';
import { AppColors } from '../../constants/Colors';
import OrderForm from './OrderTypes/OrderComponents/OrderForm';

export default function EditOrder() {
    const router = useRouter();
    const params = useLocalSearchParams<{ order?: string }>();

    const orderData = params.order ? JSON.parse(params.order) : null;

    if (!orderData) {
        return (
            <View style={styles.centered}>
                <Text style={{ color: '#FFF', fontSize: 18 }}>Eroare: date comandă lipsă.</Text>
            </View>
        );
    }

    const getOrderTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            Amplasari: 'Amplasare',
            Igienizari: 'Igienizare',
            Ridicari: 'Ridicare',
        };
        return labels[type] || type || 'N/A';
    };

    const getClientName = (): string => {
        if (!orderData.client) return 'Client necunoscut';
        if (orderData.client.type === 'individual' && orderData.client.fullName) {
            return orderData.client.fullName;
        }
        if (orderData.client.type === 'company' && orderData.client.name) {
            return orderData.client.name;
        }
        return `Client #${orderData.client.id}`;
    };

    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    const handleDeleteOrder = async () => {
        try {
            await OrderService.deleteOrder(orderData.id);
            Alert.alert('Succes', 'Comanda a fost ștearsă.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error('Error deleting order:', error);
            Alert.alert('Eroare', 'Nu s-a putut șterge comanda.');
        }
    };

    const handleSave = async () => {
        const updatedData: Record<string, any> = {
            orderType: orderData.orderType,
        };

        if (orderData.orderType === 'Amplasari') {
            if (formData.quantity) updatedData.quantity = parseInt(formData.quantity, 10);
            if (formData.locationAddress) updatedData.locationAddress = formData.locationAddress;
            if (formData.contact) updatedData.contact = formData.contact;
            if (formData.details) updatedData.details = formData.details;
            if (formData.startDate) updatedData.startDate = formData.startDate;
            if (formData.endDate) updatedData.endDate = formData.endDate;
            if (formData.igienizari) updatedData.igienizariPerMonth = parseInt(formData.igienizari, 10);
            if (formData.location) {
                updatedData.locationCoordinates = `${formData.location.latitude},${formData.location.longitude}`;
            }
            if (formData.duration) updatedData.durationDays = parseInt(formData.duration, 10);
            updatedData.isIndefinite = formData.isIndefinite || false;
            if (formData.packet) updatedData.product = { id: formData.packet.id };
        } else if (orderData.orderType === 'Ridicari') {
            if (formData.date) updatedData.pickupDate = formData.date;
            if (formData.contact) updatedData.contact = formData.contact;
            if (formData.details) updatedData.details = formData.details;
        } else if (orderData.orderType === 'Igienizari') {
            if (formData.date) updatedData.sanitationDate = formData.date;
            if (formData.details) updatedData.details = formData.details;
            if (formData.location) {
                updatedData.sanitationLocationCoordinates = `${formData.location.latitude},${formData.location.longitude}`;
                updatedData.sanitationLocationAddress = formData.location.address || null;
            }
            if (formData.subscription) updatedData.subscription = { id: formData.subscription.id };
        }

        setSaving(true);
        try {
            await OrderService.updateOrder(orderData.id, updatedData);
            Alert.alert('Succes', 'Comanda a fost actualizată.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error('Error updating order:', error);
            Alert.alert('Eroare', 'Nu s-a putut actualiza comanda.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScreenHeader title="Editare Comandă" />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Order info badges */}
                    <View style={styles.badgeRow}>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>
                                #{orderData.number || orderData.id}
                            </Text>
                        </View>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>
                                {getOrderTypeLabel(orderData.orderType)}
                            </Text>
                        </View>
                    </View>

                    {/* Client info (read-only) */}
                    <View style={styles.readOnlyCard}>
                        <Text style={styles.readOnlyLabel}>Client</Text>
                        <Text style={styles.readOnlyValue}>{getClientName()}</Text>
                    </View>

                    {/* Order form — same visual as create, pre-filled with data */}
                    <OrderForm
                        orderType={orderData.orderType}
                        client={orderData.client}
                        initialData={orderData}
                        onDataChange={setFormData}
                        onDeleteOrder={handleDeleteOrder}
                        mode="edit"
                        showTitle={false}
                    />

                    {/* Save button */}
                    <View style={{ width: '100%', marginTop: 30 }}>
                        <PrimaryButton
                            label="Salvează Modificările"
                            onPress={handleSave}
                            loading={saving}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    centered: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        alignItems: 'center',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 10,
        alignSelf: 'flex-start',
    },
    typeBadge: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typeBadgeText: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
    },
    readOnlyCard: {
        width: '100%',
        backgroundColor: '#1E3A50',
        borderRadius: 12,
        padding: 14,
        marginTop: 12,
    },
    readOnlyLabel: {
        color: '#8BA8BE',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    readOnlyValue: {
        color: AppColors.textWhite,
        fontSize: 16,
    },
});
