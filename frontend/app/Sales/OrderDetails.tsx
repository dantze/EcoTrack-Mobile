import { StyleSheet, Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AntDesign, Ionicons } from '@expo/vector-icons';
import Amplasari from './OrderTypes/Amplasari';
import Ridicari from './OrderTypes/Ridicari';
import Igienizari from './OrderTypes/Igienizari';
import { ClientService } from '../../services/ClientService';
import { RecurringIgienizareService } from '../../services/RecurringIgienizareService';

import ScreenHeader from '../../components/layout/ScreenHeader';
import { AppColors } from '../../constants/Colors';


const ORDER_TYPES = ["Amplasari", "Ridicari", "Igienizari"];

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const client = params.client ? JSON.parse(params.client as string) : null;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedType, setSelectedType] = useState(ORDER_TYPES[0]);
    const [orderData, setOrderData] = useState<any>({});
    const [parentScrollEnabled, setParentScrollEnabled] = useState(true);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        setOrderData({}); // Reset data on type change
        setIsDropdownOpen(false);
    };

    const handleDataChange = (data: any) => {
        setOrderData(data);
    };

    const handleDropdownToggle = (isOpen: boolean) => {
        setParentScrollEnabled(!isOpen);
    };

    const renderOrderComponent = () => {
        switch (selectedType) {
            case "Amplasari":
                return <Amplasari client={client} onDataChange={handleDataChange} onDropdownToggle={handleDropdownToggle} />;
            case "Ridicari":
                return <Ridicari client={client} onDataChange={handleDataChange} onDropdownToggle={handleDropdownToggle} />;
            case "Igienizari":
                return <Igienizari client={client} onDataChange={handleDataChange} onDropdownToggle={handleDropdownToggle} />;
            default:
                return null;
        }
    };

    const validateOrder = () => {


        if (selectedType === "Amplasari") {
            const { packet, quantity, isIndefinite, duration, startDate, endDate, location, contact, igienizari } = orderData;
            if (!packet) return "Selectați un pachet.";
            if (!quantity) return "Selectați cantitatea.";
            if (!isIndefinite && !duration) return "Introduceți durata contractului.";
            if (!startDate && !endDate) return "Selectați perioada de amplasare.";
            if (!location) return "Selectați locația.";
            if (!contact) return "Introduceți contactul de pe șantier.";

            if (!igienizari) return "Selectați numărul de igienizări.";
        }
        else if (selectedType === "Ridicari") {
            const { packetsToRemove, date, contact } = orderData;
            const hasPackets = packetsToRemove && Object.keys(packetsToRemove).length > 0;
            if (!hasPackets) return "Selectați cel puțin un pachet de ridicat.";
            if (!date) return "Selectați data ridicării.";
            if (!contact) return "Introduceți persoana de contact.";

        }
        else if (selectedType === "Igienizari") {
            const { subscription, location, date, isRecurring, recurrenceEndDate, isIndefinite } = orderData;
            if (!subscription?.id) return "Selectați abonamentul.";
            if (!location) return "Selectați locația.";
            if (!date) return "Selectați data igienizării.";
            if (isRecurring && !isIndefinite && !recurrenceEndDate) return "Selectați data de sfârșit a recurenței sau bifați Nedeterminat.";
            if (isRecurring && !isIndefinite && recurrenceEndDate && date && recurrenceEndDate <= date) return "Data de sfârșit trebuie să fie după data de începere.";
        }
        return null; // No errors
    };

    if (!client) {
        return (
            <View style={styles.container}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={{ color: 'white', marginTop: 50, textAlign: 'center' }}>No client data found.</Text>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={{ flex: 1 }}>
                <ScreenHeader title="Detalii Comandă" />

                <ScrollView
                    style={styles.scrollContent}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={parentScrollEnabled}
                >
                    {/* Client Info Summary */}
                    <View style={styles.clientSummary}>
                        <Text style={styles.clientLabel}>Client Selectat:</Text>
                        <Text style={styles.clientName}>{client.type === 'company' ? client.name : client.email}</Text>
                        {client.type === 'company' && <Text style={styles.clientDetail}>CUI: {client.CUI}</Text>}
                    </View>



                    {/* Dropdown for Order Type */}
                    <Text style={styles.sectionLabel}>Tip Comandă</Text>
                    <View style={[styles.dropdownWrapper, { zIndex: 200 }]}>
                        <Pressable
                            style={styles.dropdownButton}
                            onPress={toggleDropdown}
                        >
                            <Text style={styles.dropdownButtonText}>{selectedType}</Text>
                            <AntDesign name={isDropdownOpen ? "up" : "down"} size={16} color="#16283C" />
                        </Pressable>

                        {isDropdownOpen && (
                            <View style={styles.dropdownList}>
                                {ORDER_TYPES.map((item, index) => (
                                    <Pressable
                                        key={index}
                                        style={({ pressed }) => [
                                            styles.dropdownItem,
                                            pressed && { backgroundColor: '#F5F5F5' }
                                        ]}
                                        onPress={() => handleSelectType(item)}
                                    >
                                        <Text style={styles.dropdownItemText}>{item}</Text>
                                        {index < ORDER_TYPES.length - 1 && <View style={styles.divider} />}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={{ zIndex: 100 }}>
                        {renderOrderComponent()}
                    </View>

                    {/* Submit Button */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.submitButton,
                            pressed && { opacity: 0.9 }
                        ]}
                        onPress={async () => {
                            const error = validateOrder();
                            if (error) {
                                alert(error);
                                return;
                            }

                            if (selectedType === "Amplasari") {
                                try {
                                    const payload = {
                                        orderType: selectedType,
                                        product: { id: orderData.packet.id },
                                        quantity: parseInt(orderData.quantity),
                                        isIndefinite: orderData.isIndefinite,
                                        durationDays: orderData.isIndefinite ? null : parseInt(orderData.duration),
                                        startDate: orderData.startDate,
                                        endDate: orderData.endDate,
                                        locationCoordinates: orderData.location ? `${orderData.location.latitude},${orderData.location.longitude}` : null,
                                        locationAddress: orderData.locationAddress || null,
                                        contact: orderData.contact,
                                        igienizariPerMonth: parseInt(orderData.igienizari),
                                        details: orderData.details,

                                    };

                                    console.log("Sending Payload:", JSON.stringify(payload, null, 2));

                                    const savedOrder = await ClientService.createOrder(client.id, payload);

                                    alert("Comanda Amplasare salvată cu succes!");
                                    console.log("Saved Order:", savedOrder);
                                    router.dismiss(2);
                                } catch (err: any) {
                                    console.error("Error submitting order:", err);
                                    alert("Eroare la salvarea comenzii: " + (err.message || "Eroare necunoscută"));
                                }
                            } else if (selectedType === "Ridicari") {
                                try {
                                    const { packetsToRemove, packetGroups, date, contact, details } = orderData;
                                    const entries = Object.entries(packetsToRemove as { [key: string]: number });

                                    for (const [groupKey, count] of entries) {
                                        const group = (packetGroups as any[])?.find((g: any) => g.key === groupKey);
                                        const payload = {
                                            orderType: "Ridicari",
                                            pickupDate: date,
                                            pickupQuantity: count,
                                            pickupProductName: group?.productName || groupKey,
                                            pickupLocationAddress: group?.address || null,
                                            pickupLocationCoordinates: group?.locationCoordinates || null,
                                            contact,
                                            details: details || null,
                                        };
                                        await ClientService.createOrder(client.id, payload);
                                    }

                                    alert("Comanda Ridicare salvată cu succes!");
                                    router.dismiss(2);
                                } catch (err: any) {
                                    console.error("Error submitting Ridicari order:", err);
                                    alert("Eroare la salvarea comenzii: " + (err.message || "Eroare necunoscută"));
                                }
                            } else if (selectedType === "Igienizari") {
                                try {
                                    const { subscription, location, date, details, isRecurring, recurrenceEndDate, isIndefinite } = orderData;

                                    if (isRecurring) {
                                        // Create a recurring igienizare plan (single order)
                                        const payload = {
                                            subscription: { id: subscription.id },
                                            startDate: date,
                                            endDate: isIndefinite ? '2100-01-01' : recurrenceEndDate,
                                            isIndefinite: isIndefinite || false,
                                            sanitationLocationCoordinates: location
                                                ? `${location.latitude},${location.longitude}`
                                                : null,
                                            sanitationLocationAddress: location?.address || null,
                                            contact: orderData.contact || null,
                                            details: details || null,
                                        };

                                        await RecurringIgienizareService.create(client.id, payload);
                                        alert("Igienizare recurentă creată cu succes!");
                                    } else {
                                        // Create a normal one-time igienizare order
                                        const payload = {
                                            orderType: "Igienizari",
                                            subscription: { id: subscription.id },
                                            sanitationDate: date,
                                            sanitationLocationCoordinates: location
                                                ? `${location.latitude},${location.longitude}`
                                                : null,
                                            sanitationLocationAddress: location?.address || null,
                                            contact: orderData.contact || null,
                                            details: details || null,
                                        };

                                        await ClientService.createOrder(client.id, payload);
                                        alert("Comanda Igienizare salvată cu succes!");
                                    }
                                    router.dismiss(2);
                                } catch (err: any) {
                                    console.error("Error submitting Igienizari order:", err);
                                    alert("Eroare la salvarea comenzii: " + (err.message || "Eroare necunoscută"));
                                }
                            }
                        }}
                    >
                        <Text style={styles.submitButtonText}>Trimite Comanda</Text>
                    </Pressable>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    )
}

export default OrderDetails

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
    },
    headerText: {
        color: AppColors.textWhite,
        fontSize: 24,
        fontWeight: 'bold',
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    clientSummary: {
        backgroundColor: '#2A3E55',
        padding: 15,
        borderRadius: 12,
        marginBottom: 25,
    },
    clientLabel: {
        color: '#999',
        fontSize: 14,
        marginBottom: 5,
    },
    clientName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    clientDetail: {
        color: '#CCCCCC',
        fontSize: 14,
        marginTop: 2,
    },
    sectionLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 5,
    },
    // Dropdown
    dropdownWrapper: {
        width: '100%',
        position: 'relative',
        marginBottom: 20,
    },
    dropdownButton: {
        width: '100%',
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    dropdownButtonText: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dropdownList: {
        position: 'absolute',
        top: 55,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
        paddingVertical: 5,
        elevation: 5,
        zIndex: 1000,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    dropdownItemText: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '100%',
    },
    submitButton: {
        backgroundColor: AppColors.buttonBackground,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
})
