import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { AntDesign } from '@expo/vector-icons';
import DateSelector from './OrderComponents/DateSelector';
import LocationPicker from './OrderComponents/LocationPicker';
import { SubscriptionService, Subscription } from '../../../services/SubscriptionService';

const Igienizari = ({ client, onDataChange }: { client: any, onDataChange: (data: any) => void }) => {
    // Subscription State
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
    const [isSubscriptionDropdownOpen, setIsSubscriptionDropdownOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

    // Location State
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Date State
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    // Additional Details State
    const [additionalDetails, setAdditionalDetails] = useState('');

    // Fetch active subscriptions from the backend
    useEffect(() => {
        const fetchSubscriptions = async () => {
            setLoadingSubscriptions(true);
            try {
                const data = await SubscriptionService.getActiveSubscriptions();
                setSubscriptions(data);
            } catch (err) {
                console.error('Failed to fetch subscriptions:', err);
            } finally {
                setLoadingSubscriptions(false);
            }
        };
        fetchSubscriptions();
    }, []);

    // Sync data with parent
    useEffect(() => {
        onDataChange({
            subscription: selectedSubscription,  // full subscription object (id, name, type, ...)
            location,
            date: dateStart,
            details: additionalDetails
        });
    }, [selectedSubscription, location, dateStart, additionalDetails]);

    const toggleSubscriptionDropdown = () => {
        setIsSubscriptionDropdownOpen(!isSubscriptionDropdownOpen);
    };

    const handleSelectSubscription = (sub: any) => {
        setSelectedSubscription(sub);
        setIsSubscriptionDropdownOpen(false);
    };

    // Helper: format a subscription label for the dropdown
    const formatSubscriptionLabel = (sub: any) => {
        if (sub.type === 'ONE_TIME') {
            return `${sub.name} — ${sub.price} RON (o singură vizită)`;
        }
        return `${sub.name} — ${sub.price} RON/lună · ${sub.visitsPerMonth}x/lună`;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Formular Igienizări</Text>

            {/* --- ABONAMENT IGIENIZARI --- */}
            <Text style={styles.label}>Abonament Igienizări</Text>
            <View style={[styles.dropdownContainer, { zIndex: 300 }]}>
                <Pressable style={styles.dropdownButton} onPress={toggleSubscriptionDropdown}>
                    <Text style={styles.dropdownText} numberOfLines={1}>
                        {selectedSubscription
                            ? formatSubscriptionLabel(selectedSubscription)
                            : 'Selectează abonament...'}
                    </Text>
                    <AntDesign name={isSubscriptionDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                </Pressable>

                {isSubscriptionDropdownOpen && (
                    <View style={styles.dropdownList}>
                        {loadingSubscriptions ? (
                            <ActivityIndicator size="small" color="#427992" style={{ padding: 15 }} />
                        ) : subscriptions.length === 0 ? (
                            <Text style={styles.emptyText}>Nu există abonamente active.</Text>
                        ) : (
                            <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                                {subscriptions.map((sub, index) => (
                                    <Pressable
                                        key={sub.id}
                                        style={({ pressed }) => [
                                            styles.dropdownItem,
                                            pressed && { backgroundColor: '#F5F5F5' }
                                        ]}
                                        onPress={() => handleSelectSubscription(sub)}
                                    >
                                        {/* Subscription Name */}
                                        <Text style={styles.dropdownItemText}>{sub.name}</Text>

                                        {/* Type Badge */}
                                        <View style={[styles.typeBadge, sub.type === 'ONE_TIME' ? styles.badgeOneTime : styles.badgeRecurring]}>
                                            <Text style={styles.typeBadgeText}>
                                                {sub.type === 'ONE_TIME' ? 'O singură dată' : 'Recurent'}
                                            </Text>
                                        </View>

                                        {/* Details row */}
                                        <Text style={styles.dropdownItemSub}>
                                            {sub.type === 'ONE_TIME'
                                                ? `${sub.price} RON`
                                                : `${sub.price} RON/lună · ${sub.visitsPerMonth} vizite/lună`}
                                        </Text>

                                        {index < subscriptions.length - 1 && <View style={styles.divider} />}
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}
            </View>

            {/* --- LOCATION --- */}
            <LocationPicker
                onLocationSelect={(loc) => setLocation(loc)}
                initialLocation={location || undefined}
            />

            {/* --- DATA IGIENIZARE --- */}
            <DateSelector
                label="Dată Igienizare"
                onDateChange={(start, end) => {
                    setDateStart(start);
                    setDateEnd(end);
                }}
                onToggle={(isOpen) => {
                    if (isOpen) setIsSubscriptionDropdownOpen(false);
                }}
            />

            {/* --- DETALII SUPLIMENTARE --- */}
            <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Detalii Suplimentare</Text>
                <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={additionalDetails}
                    onChangeText={setAdditionalDetails}
                    placeholder="Alte informații..."
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                />
            </View>

        </View>
    )
}

export default Igienizari

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#2A3E55',
        borderRadius: 12,
        marginTop: 10,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    label: {
        color: '#CCCCCC',
        fontSize: 14,
        marginBottom: 5,
        fontWeight: '600',
    },
    // Dropdown
    dropdownContainer: {
        marginBottom: 15,
        position: 'relative',
    },
    dropdownButton: {
        height: 44,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    dropdownText: {
        color: '#16283C',
        fontSize: 13,
        flex: 1,
        marginRight: 8,
    },
    dropdownList: {
        position: 'absolute',
        top: 49,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        elevation: 5,
        zIndex: 1000,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    dropdownItemText: {
        color: '#16283C',
        fontSize: 14,
        fontWeight: '600',
    },
    dropdownItemSub: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    emptyText: {
        color: '#999',
        fontSize: 13,
        fontStyle: 'italic',
        padding: 15,
        textAlign: 'center',
    },
    typeBadge: {
        alignSelf: 'flex-start',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 3,
    },
    badgeOneTime: {
        backgroundColor: '#E3F2FD',
    },
    badgeRecurring: {
        backgroundColor: '#E8F5E9',
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#16283C',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '100%',
        marginTop: 8,
    },
    // Input
    input: {
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 10,
        color: '#16283C',
    },
    multilineInput: {
        height: 100,
        paddingTop: 10,
    },
})
