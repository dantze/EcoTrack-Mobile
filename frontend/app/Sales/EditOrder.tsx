import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrderService } from '../../services/OrderService';

type InputFieldProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
};

const InputField = ({ label, value, onChangeText, placeholder = '', keyboardType = 'default' }: InputFieldProps) => (
    <View style={styles.inputWrapper}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#999"
            keyboardType={keyboardType}
        />
    </View>
);

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
            amplasari: 'Amplasare',
            igienizari: 'Igienizare',
            ridicari: 'Ridicare',
        };
        return labels[type?.toLowerCase()] || type || 'N/A';
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

    // Form state initialized with existing data
    const [quantity, setQuantity] = useState(orderData.quantity?.toString() || '');
    const [locationAddress, setLocationAddress] = useState(orderData.locationAddress || '');
    const [contact, setContact] = useState(orderData.contact || '');
    const [details, setDetails] = useState(orderData.details || '');
    const [startDate, setStartDate] = useState(orderData.startDate || '');
    const [endDate, setEndDate] = useState(orderData.endDate || '');
    const [igienizariPerMonth, setIgienizariPerMonth] = useState(
        orderData.igienizariPerMonth?.toString() || ''
    );
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const updatedData: Record<string, any> = {};

        // Only send fields that have values
        if (quantity.trim()) updatedData.quantity = parseInt(quantity.trim(), 10);
        if (locationAddress.trim()) updatedData.locationAddress = locationAddress.trim();
        if (contact.trim()) updatedData.contact = contact.trim();
        if (details.trim()) updatedData.details = details.trim();
        if (startDate.trim()) updatedData.startDate = startDate.trim();
        if (endDate.trim()) updatedData.endDate = endDate.trim();
        if (igienizariPerMonth.trim())
            updatedData.igienizariPerMonth = parseInt(igienizariPerMonth.trim(), 10);

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
                <View style={styles.headerContainer}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </Pressable>
                    <Text style={styles.headerText}>Editare Comandă</Text>
                </View>

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

                    {/* Product info (read-only) */}
                    {orderData.product?.name && (
                        <View style={styles.readOnlyCard}>
                            <Text style={styles.readOnlyLabel}>Produs</Text>
                            <Text style={styles.readOnlyValue}>{orderData.product.name}</Text>
                        </View>
                    )}

                    {/* Editable fields */}
                    <View style={{ width: '100%', marginTop: 20 }}>
                        <InputField
                            label="Cantitate"
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="numeric"
                        />
                        <InputField
                            label="Adresă locație"
                            value={locationAddress}
                            onChangeText={setLocationAddress}
                        />
                        <InputField
                            label="Contact"
                            value={contact}
                            onChangeText={setContact}
                            keyboardType="phone-pad"
                        />
                        <InputField
                            label="Detalii"
                            value={details}
                            onChangeText={setDetails}
                        />
                        <InputField
                            label="Data început"
                            value={startDate}
                            onChangeText={setStartDate}
                            placeholder="ex: 2026-03-01"
                        />
                        <InputField
                            label="Data sfârșit"
                            value={endDate}
                            onChangeText={setEndDate}
                            placeholder="ex: 2026-06-01"
                        />
                        {orderData.orderType?.toLowerCase() !== 'ridicari' && (
                            <InputField
                                label="Igienizări / lună"
                                value={igienizariPerMonth}
                                onChangeText={setIgienizariPerMonth}
                                keyboardType="numeric"
                            />
                        )}
                    </View>

                    {/* Save button */}
                    <View style={{ width: '100%', marginTop: 30 }}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.saveButton,
                                pressed && { opacity: 0.9 },
                                saving && { opacity: 0.6 },
                            ]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Salvează Modificările</Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    centered: {
        flex: 1,
        backgroundColor: '#16283C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        marginTop: 75,
        paddingHorizontal: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
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
        backgroundColor: '#427992',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typeBadgeText: {
        color: '#FFFFFF',
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
        color: '#FFFFFF',
        fontSize: 16,
    },
    inputWrapper: {
        marginBottom: 15,
        width: '100%',
    },
    label: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 5,
    },
    input: {
        width: '100%',
        height: 45,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#16283C',
    },
    saveButton: {
        width: '100%',
        height: 55,
        backgroundColor: '#427992',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
