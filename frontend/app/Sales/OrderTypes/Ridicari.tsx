import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { AntDesign } from '@expo/vector-icons';
import DateSelector from './OrderComponents/DateSelector';
import { ClientService } from '../../../services/ClientService';
import { TaskService } from '../../../services/TaskService';
import * as Location from 'expo-location';

const Ridicari = ({ client, onDataChange }: { client: any, onDataChange: (data: any) => void }) => {
    // State
    const [clientPackets, setClientPackets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    // Stores how many of each packet group to remove: { groupKey: count }
    const [packetsToRemove, setPacketsToRemove] = useState<{ [key: string]: number }>({});

    // New Fields State
    const [contactPersoana, setContactPersoana] = useState('');
    const [additionalDetails, setAdditionalDetails] = useState('');

    // Date Placement State
    const [placementStartDate, setPlacementStartDate] = useState('');
    const [placementEndDate, setPlacementEndDate] = useState('');

    // Sync data with parent
    useEffect(() => {
        onDataChange({
            packetsToRemove,
            packetGroups: clientPackets,   // full group metadata for payload building
            contact: contactPersoana,
            details: additionalDetails,
            date: placementStartDate
        });
    }, [packetsToRemove, clientPackets, contactPersoana, additionalDetails, placementStartDate]);

    // Fetch Client Packets & Reverse Geocode
    useEffect(() => {
        if (!client?.id) return;

        const fetchAndGroupOrders = async () => {
            setLoading(true);
            try {
                // 1. Fetch all orders for this client
                const orders = await ClientService.getOrders(client.id);

                // 2. Split into Amplasare (deployed) and Ridicare (already picked up)
                const amplasareOrders = orders.filter((o: any) =>
                    o.orderType === 'Amplasari' && o.locationCoordinates
                );
                const ridicareOrders = orders.filter((o: any) =>
                    o.orderType === 'Ridicari'
                );

                // 3. Group Amplasare orders by Product + Location → totalCount = units deployed
                const groups: { [key: string]: any } = {};

                for (const order of amplasareOrders) {
                    const locKey = order.locationCoordinates; // "lat,long"
                    const prodId = order.product?.id || 'unknown';
                    const groupKey = `${prodId}_${locKey}`;

                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            key: groupKey,
                            productId: prodId,
                            productName: order.product?.name || 'Produs Necunoscut',
                            locationCoordinates: locKey,
                            totalCount: 0,
                            alreadyPickedUp: 0,
                            address: 'Se încarcă adresa...',
                            orders: [],
                        };
                    }
                    groups[groupKey].totalCount += (order.quantity || 1);
                    groups[groupKey].orders.push(order);
                }

                // 4. For each Ridicare order: check task status
                //    - COMPLETED → subtracted silently (pickup done, units gone)
                //    - Pending (NEW / IN_PROGRESS / no task yet) → subtracted AND flagged as pending
                for (const ro of ridicareOrders) {
                    const locKey = ro.pickupLocationCoordinates;
                    if (!locKey) continue;

                    const matchingKey = Object.keys(groups).find(k => {
                        const g = groups[k];
                        return g.locationCoordinates === locKey &&
                            (g.productName === ro.pickupProductName || ro.pickupProductName == null);
                    });

                    if (!matchingKey) continue;

                    const qty = ro.pickupQuantity || 0;
                    groups[matchingKey].alreadyPickedUp += qty;

                    // Check if the task for this Ridicare order is already COMPLETED
                    try {
                        const taskStatus = await TaskService.checkOrderHasTask(ro.id);
                        const isCompleted = taskStatus.hasTask && (taskStatus as any).status === 'COMPLETED';
                        if (!isCompleted) {
                            // Still pending — increment the pending counter for the hint
                            groups[matchingKey].pendingPickupCount =
                                (groups[matchingKey].pendingPickupCount || 0) + qty;
                        }
                    } catch {
                        // If we can't determine, assume pending to be safe
                        groups[matchingKey].pendingPickupCount =
                            (groups[matchingKey].pendingPickupCount || 0) + qty;
                    }
                }

                // 5. Compute effective available count and hide exhausted groups
                for (const key of Object.keys(groups)) {
                    const g = groups[key];
                    g.availableCount = Math.max(0, g.totalCount - g.alreadyPickedUp);
                }

                // Remove groups where everything has already been picked up
                const groupsArray = Object.values(groups).filter((g: any) => g.availableCount > 0);
                setClientPackets(groupsArray);

                // 5. Reverse Geocode (Async)
                // We do this after setting initial state so the UI shows up quickly
                const updatedGroups = [...groupsArray];
                let hasUpdates = false;

                for (let i = 0; i < updatedGroups.length; i++) {
                    const group = updatedGroups[i];
                    if (group.locationCoordinates && group.locationCoordinates.includes(',')) {
                        const [latStr, longStr] = group.locationCoordinates.split(',');
                        const lat = parseFloat(latStr);
                        const long = parseFloat(longStr);

                        try {
                            const addressResponse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: long });
                            if (addressResponse && addressResponse.length > 0) {
                                const addr = addressResponse[0];
                                // Construct a readable address
                                const street = addr.street || '';
                                const number = addr.streetNumber || '';
                                const city = addr.city || addr.subregion || '';
                                group.address = `${street} ${number}, ${city}`.trim();
                                if (group.address === ',') group.address = 'Adresă necunoscută';
                                hasUpdates = true;
                            }
                        } catch (err) {
                            console.log("Geocoding error for", group.locationCoordinates, err);
                            group.address = "Eroare localizare";
                            hasUpdates = true;
                        }
                    }
                }

                if (hasUpdates) {
                    setClientPackets([...updatedGroups]);
                }

            } catch (error) {
                console.error("Failed to fetch/group orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndGroupOrders();
    }, [client?.id]);

    const handleIncrement = (groupKey: string, maxCount: number) => {
        setPacketsToRemove(prev => {
            const current = prev[groupKey] || 0;
            if (current < maxCount) {
                return { ...prev, [groupKey]: current + 1 };
            }
            return prev;
        });
    };

    const handleDecrement = (groupKey: string) => {
        setPacketsToRemove(prev => {
            const current = prev[groupKey] || 0;
            if (current > 0) {
                const newState = { ...prev, [groupKey]: current - 1 };
                if (newState[groupKey] === 0) {
                    delete newState[groupKey];
                    return newState;
                }
                return newState;
            }
            return prev;
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Formular Ridicări</Text>

            {/* --- PACKET LIST --- */}
            <Text style={styles.label}>Selectează Pachete de Ridicat</Text>
            <View style={styles.packetListContainer}>
                {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : clientPackets.length > 0 ? (
                    clientPackets.map((group) => {
                        const toRemove = packetsToRemove[group.key] || 0;
                        const available = group.availableCount;  // already-picked-up subtracted
                        const remaining = available - toRemove;

                        return (
                            <View key={group.key} style={[styles.packetRow, toRemove > 0 && styles.packetRowActive]}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={styles.packetName}>{group.productName}</Text>

                                    {/* Location Address */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <AntDesign name="environment" size={12} color="#666" style={{ marginRight: 4 }} />
                                        <Text style={styles.addressText} numberOfLines={2}>
                                            {group.address}
                                        </Text>
                                    </View>

                                    <Text style={styles.packetSubtext}>
                                        Disponibil: <Text style={{ fontWeight: 'bold', color: remaining > 0 ? '#4CAF50' : '#E53935' }}>{remaining}</Text> / {available}
                                        {group.pendingPickupCount > 0 && (
                                            <Text style={{ color: '#E53935' }}>{`  (-${group.pendingPickupCount} urmează să fie ridicate)`}</Text>
                                        )}
                                    </Text>
                                </View>

                                <View style={styles.counterContainer}>
                                    <Pressable
                                        style={[styles.counterButton, toRemove === 0 && styles.counterButtonDisabled]}
                                        onPress={() => handleDecrement(group.key)}
                                    >
                                        <AntDesign name="minus" size={16} color={toRemove === 0 ? "#ccc" : "#16283C"} />
                                    </Pressable>

                                    <View style={styles.countDisplay}>
                                        <Text style={[styles.countText, toRemove > 0 && { color: '#E53935', fontWeight: 'bold' }]}>
                                            {toRemove > 0 ? `-${toRemove}` : '0'}
                                        </Text>
                                    </View>

                                    <Pressable
                                        style={[styles.counterButton, toRemove >= available && styles.counterButtonDisabled]}
                                        onPress={() => handleIncrement(group.key, available)}
                                    >
                                        <AntDesign name="plus" size={16} color={toRemove >= available ? "#ccc" : "#16283C"} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
                        Acest client nu are pachete active la locații cunoscute.
                    </Text>
                )}
            </View>

            {/* --- DATA RIDICARE --- */}
            <DateSelector
                label="Dată Ridicare"
                onDateChange={(start, end) => {
                    setPlacementStartDate(start);
                    setPlacementEndDate(end);
                }}
            />

            {/* --- CONTACT PERSOANA RESPONSABILA --- */}
            <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Contact Persoană Responsabilă Amplasare</Text>
                <TextInput
                    style={styles.input}
                    value={contactPersoana}
                    onChangeText={setContactPersoana}
                    placeholder="Nume / Telefon"
                    placeholderTextColor="#999"
                />
            </View>

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

export default Ridicari

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
    // Packet List Styles
    packetListContainer: {
        marginTop: 5,
        marginBottom: 15,
    },
    packetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    packetRowActive: {
        borderWidth: 1,
        borderColor: '#E53935',
        backgroundColor: '#FFF5F5',
    },
    packetName: {
        color: '#16283C',
        fontSize: 14,
        fontWeight: '500',
    },
    packetSubtext: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    addressText: {
        color: '#666',
        fontSize: 12,
        fontStyle: 'italic',
        flex: 1,
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 20,
        padding: 2,
    },
    counterButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
    },
    counterButtonDisabled: {
        backgroundColor: '#E0E0E0',
        elevation: 0,
    },
    countDisplay: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 14,
        color: '#16283C',
        fontWeight: '500',
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
