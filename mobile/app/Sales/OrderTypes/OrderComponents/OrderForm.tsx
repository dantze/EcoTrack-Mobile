import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, Pressable, Switch,
    TextInput, ActivityIndicator, Alert,
    Modal, FlatList, TouchableOpacity,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import DateSelector from './DateSelector';
import LocationPicker from './LocationPicker';
import { ClientService } from '../../../../services/ClientService';
import { TaskService } from '../../../../services/TaskService';
import { SubscriptionService, Subscription } from '../../../../services/SubscriptionService';
import { API_BASE_URL } from '../../../../constants/ApiConfig';
import * as Location from 'expo-location';
import PhoneInputField from '../../../../components/forms/PhoneInputField';

// ─── Constants ──────────────────────────────────────────────────────────────
const QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1).toString());
const IGIENIZARI_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

const TITLES: Record<string, string> = {
    Amplasari: 'Formular Amplasări',
    Ridicari: 'Formular Ridicări',
    Igienizari: 'Formular Igienizări',
};

// ─── Types ──────────────────────────────────────────────────────────────────
export type OrderFormMode = 'create' | 'edit';

interface OrderFormProps {
    orderType: 'Amplasari' | 'Ridicari' | 'Igienizari';
    client?: any;
    /** Existing order data to pre-fill the form (edit mode). */
    initialData?: any;
    onDataChange: (data: any) => void;
    mode?: OrderFormMode;
    showTitle?: boolean;
    /** Called when all pickup packets are removed in edit mode (order should be deleted). */
    onDeleteOrder?: () => void;
    /** Called when a dropdown opens/closes — used to disable parent ScrollView on Android. */
    onDropdownToggle?: (isOpen: boolean) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const parseCoordinates = (coords?: string): { latitude: number; longitude: number } | null => {
    if (!coords || !coords.includes(',')) return null;
    const [lat, lng] = coords.split(',').map(Number);
    return isNaN(lat) || isNaN(lng) ? null : { latitude: lat, longitude: lng };
};

// ─── Component ──────────────────────────────────────────────────────────────
const OrderForm: React.FC<OrderFormProps> = ({
    orderType,
    client,
    initialData,
    onDataChange,
    mode = 'create',
    showTitle = true,
    onDeleteOrder,
    onDropdownToggle,
}) => {
    const isEdit = mode === 'edit';

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    // ─── Shared ─────────────────────────────────────────────────────────
    const [contact, setContact] = useState(initialData?.contact || '');
    const [contactCountryCode, setContactCountryCode] = useState('+40');
    const [details, setDetails] = useState(initialData?.details || '');

    const [dateStart, setDateStart] = useState(() => {
        if (!initialData) return '';
        if (orderType === 'Amplasari') return initialData.startDate || '';
        if (orderType === 'Ridicari') return initialData.pickupDate || '';
        if (orderType === 'Igienizari') return initialData.sanitationDate || '';
        return '';
    });
    const [dateEnd, setDateEnd] = useState(() => {
        if (orderType === 'Amplasari' && initialData) return initialData.endDate || '';
        return '';
    });

    // ─── Amplasari ──────────────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [selectedPacket, setSelectedPacket] = useState<any>(initialData?.product || null);
    const [isPacketDropdownOpen, setIsPacketDropdownOpen] = useState(false);
    const [quantity, setQuantity] = useState(initialData?.quantity?.toString() || '1');
    const [isQuantityDropdownOpen, setIsQuantityDropdownOpen] = useState(false);
    const [isIndefinite, setIsIndefinite] = useState(initialData?.isIndefinite || false);
    const [durationDays, setDurationDays] = useState(initialData?.durationDays?.toString() || '');
    const [igienizariPerMonth, setIgienizariPerMonth] = useState(
        initialData?.igienizariPerMonth?.toString() || '1'
    );
    const [isIgienizariDropdownOpen, setIsIgienizariDropdownOpen] = useState(false);
    const [ampLocation, setAmpLocation] = useState<any>(() => {
        if (!initialData?.locationCoordinates) return null;
        const parsed = parseCoordinates(initialData.locationCoordinates);
        return parsed ? { ...parsed, address: initialData.locationAddress } : null;
    });
    const [existingPlacements, setExistingPlacements] = useState<any[]>([]);

    // ─── Ridicari ───────────────────────────────────────────────────────
    const [clientPackets, setClientPackets] = useState<any[]>([]);
    const [loadingPackets, setLoadingPackets] = useState(false);
    const [packetsToRemove, setPacketsToRemove] = useState<{ [key: string]: number }>({});

    // ─── Igienizari ─────────────────────────────────────────────────────
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
    const [isSubscriptionDropdownOpen, setIsSubscriptionDropdownOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<any>(
        initialData?.subscription || null
    );
    const [igiLocation, setIgiLocation] = useState<any>(() => {
        if (!initialData?.sanitationLocationCoordinates) return null;
        const parsed = parseCoordinates(initialData.sanitationLocationCoordinates);
        return parsed ? { ...parsed, address: initialData.sanitationLocationAddress } : null;
    });
    const [igiExistingPlacements, setIgiExistingPlacements] = useState<any[]>([]);

    // ─── Igienizari: Recurring ──────────────────────────────────────────
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequencyDays, setFrequencyDays] = useState('30');
    const [isFrequencyDropdownOpen, setIsFrequencyDropdownOpen] = useState(false);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    const [recurrenceIndefinite, setRecurrenceIndefinite] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════
    // DATA FETCHING EFFECTS
    // ═══════════════════════════════════════════════════════════════════════

    // Amplasari → Fetch products
    useEffect(() => {
        if (orderType !== 'Amplasari') return;
        fetch(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => {
                if (data?.length > 0) {
                    setProducts(data);
                    if (isEdit && initialData?.product) {
                        const match = data.find((p: any) => p.id === initialData.product.id);
                        if (match) setSelectedPacket(match);
                    }
                }
            })
            .catch(err => console.log('Failed to fetch products', err));
    }, [orderType]);

    // Amplasari → Fetch existing placements for map markers
    useEffect(() => {
        if (orderType !== 'Amplasari' || !client?.id) return;
        ClientService.getOrders(client.id)
            .then(orders => {
                const raw = orders
                    .filter((o: any) => o.locationCoordinates?.includes(','))
                    .map((o: any) => {
                        const [lat, lng] = o.locationCoordinates.split(',').map(Number);
                        return { id: o.id, latitude: lat, longitude: lng, count: o.quantity || 1, name: o.product?.name || 'Produs' };
                    });
                const clustered: any[] = [];
                const THRESHOLD = 0.0002;
                raw.forEach((p: any) => {
                    const existing = clustered.find(c =>
                        Math.abs(c.latitude - p.latitude) < THRESHOLD &&
                        Math.abs(c.longitude - p.longitude) < THRESHOLD
                    );
                    if (existing) existing.count += p.count;
                    else clustered.push({ ...p });
                });
                setExistingPlacements(clustered);
            })
            .catch(err => console.error('Failed to fetch client orders', err));
    }, [orderType, client]);

    // Igienizari → Fetch existing placements for map markers
    useEffect(() => {
        if (orderType !== 'Igienizari' || !client?.id) return;
        ClientService.getOrders(client.id)
            .then(orders => {
                const raw = orders
                    .filter((o: any) => o.locationCoordinates?.includes(','))
                    .map((o: any) => {
                        const [lat, lng] = o.locationCoordinates.split(',').map(Number);
                        return { id: o.id, latitude: lat, longitude: lng, count: o.quantity || 1, name: o.product?.name || 'Produs' };
                    });
                const clustered: any[] = [];
                const THRESHOLD = 0.0002;
                raw.forEach((p: any) => {
                    const existing = clustered.find(c =>
                        Math.abs(c.latitude - p.latitude) < THRESHOLD &&
                        Math.abs(c.longitude - p.longitude) < THRESHOLD
                    );
                    if (existing) existing.count += p.count;
                    else clustered.push({ ...p });
                });
                setIgiExistingPlacements(clustered);
            })
            .catch(err => console.error('Failed to fetch client orders for Igienizari', err));
    }, [orderType, client]);

    // Ridicari → Fetch & group client packets
    useEffect(() => {
        if (orderType !== 'Ridicari' || !client?.id) return;

        const fetchAndGroupOrders = async () => {
            setLoadingPackets(true);
            try {
                const orders = await ClientService.getOrders(client.id);
                const amplasareOrders = orders.filter((o: any) => o.orderType === 'Amplasari' && o.locationCoordinates);
                const ridicareOrders = orders.filter((o: any) => o.orderType === 'Ridicari');

                const groups: { [key: string]: any } = {};
                for (const order of amplasareOrders) {
                    const locKey = order.locationCoordinates;
                    const prodId = order.product?.id || 'unknown';
                    const gk = `${prodId}_${locKey}`;
                    if (!groups[gk]) {
                        groups[gk] = {
                            key: gk, productId: prodId,
                            productName: order.product?.name || 'Produs Necunoscut',
                            locationCoordinates: locKey,
                            totalCount: 0, alreadyPickedUp: 0,
                            address: 'Se încarcă adresa...', orders: [],
                        };
                    }
                    groups[gk].totalCount += (order.quantity || 1);
                    groups[gk].orders.push(order);
                }

                for (const ro of ridicareOrders) {
                    // Skip the current order being edited so it doesn't reduce available count
                    if (isEdit && initialData && ro.id === initialData.id) continue;
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
                    try {
                        const taskStatus = await TaskService.checkOrderHasTask(ro.id);
                        const isCompleted = taskStatus.hasTask && (taskStatus as any).status === 'COMPLETED';
                        if (!isCompleted) {
                            groups[matchingKey].pendingPickupCount = (groups[matchingKey].pendingPickupCount || 0) + qty;
                        }
                    } catch {
                        groups[matchingKey].pendingPickupCount = (groups[matchingKey].pendingPickupCount || 0) + qty;
                    }
                }

                for (const key of Object.keys(groups)) {
                    groups[key].availableCount = Math.max(0, groups[key].totalCount - groups[key].alreadyPickedUp);
                }

                const groupsArray = Object.values(groups).filter((g: any) => g.availableCount > 0);
                setClientPackets(groupsArray);

                // Pre-fill for edit mode
                if (isEdit && initialData) {
                    const matchingGroup = groupsArray.find((g: any) =>
                        g.locationCoordinates === initialData.pickupLocationCoordinates &&
                        g.productName === initialData.pickupProductName
                    );
                    if (matchingGroup) {
                        setPacketsToRemove({ [matchingGroup.key]: initialData.pickupQuantity || 0 });
                    }
                }

                // Reverse geocode
                const updated = [...groupsArray];
                let changed = false;
                for (const group of updated) {
                    if (!group.locationCoordinates?.includes(',')) continue;
                    const [lat, lng] = group.locationCoordinates.split(',').map(Number);
                    try {
                        const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                        if (res?.[0]) {
                            const a = res[0];
                            const street = a.street || '', num = a.streetNumber || '', city = a.city || a.subregion || '';
                            group.address = `${street} ${num}, ${city}`.trim();
                            if (group.address === ',') group.address = 'Adresă necunoscută';
                            changed = true;
                        }
                    } catch {
                        group.address = 'Eroare localizare';
                        changed = true;
                    }
                }
                if (changed) setClientPackets([...updated]);
            } catch (err) {
                console.error('Failed to fetch/group orders:', err);
            } finally {
                setLoadingPackets(false);
            }
        };

        fetchAndGroupOrders();
    }, [orderType, client?.id]);

    // Igienizari → Fetch subscriptions
    useEffect(() => {
        if (orderType !== 'Igienizari') return;
        (async () => {
            setLoadingSubscriptions(true);
            try {
                const data = await SubscriptionService.getActiveSubscriptions();
                setSubscriptions(data);
            } catch (err) {
                console.error('Failed to fetch subscriptions:', err);
            } finally {
                setLoadingSubscriptions(false);
            }
        })();
    }, [orderType]);

    // ═══════════════════════════════════════════════════════════════════════
    // SYNC DATA WITH PARENT
    // ═══════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (orderType === 'Amplasari') {
            onDataChange({
                packet: selectedPacket, quantity, isIndefinite, duration: durationDays,
                igienizari: igienizariPerMonth, contact: contactCountryCode + contact, details,
                startDate: dateStart, endDate: dateEnd,
                location: ampLocation, locationAddress: ampLocation?.address,
            });
        } else if (orderType === 'Ridicari') {
            onDataChange({
                packetsToRemove, packetGroups: clientPackets,
                contact: contactCountryCode + contact, details, date: dateStart,
            });
        } else if (orderType === 'Igienizari') {
            onDataChange({
                subscription: selectedSubscription,
                location: igiLocation, date: dateStart,
                contact: contactCountryCode + contact, details,
                isRecurring,
                frequencyDays: isRecurring ? parseInt(frequencyDays) : undefined,
                recurrenceEndDate: isRecurring && !recurrenceIndefinite ? recurrenceEndDate : undefined,
                isIndefinite: isRecurring ? recurrenceIndefinite : undefined,
            });
        }
    }, [selectedPacket, quantity, isIndefinite, durationDays, igienizariPerMonth,
        contact, contactCountryCode, details, dateStart, dateEnd, ampLocation,
        packetsToRemove, clientPackets,
        selectedSubscription, igiLocation,
        isRecurring, frequencyDays, recurrenceEndDate, recurrenceIndefinite]);

    // ═══════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    const toggleDropdown = (
        setter: React.Dispatch<React.SetStateAction<boolean>>,
        currentValue: boolean,
    ) => {
        setIsPacketDropdownOpen(false);
        setIsQuantityDropdownOpen(false);
        setIsIgienizariDropdownOpen(false);
        setIsSubscriptionDropdownOpen(false);

        const willOpen = !currentValue;
        if (willOpen) setter(true);
        onDropdownToggle?.(willOpen);
    };

    const handleIncrement = (groupKey: string, max: number) => {
        setPacketsToRemove(prev => {
            const cur = prev[groupKey] || 0;
            return cur < max ? { ...prev, [groupKey]: cur + 1 } : prev;
        });
    };

    const handleDecrement = (groupKey: string) => {
        setPacketsToRemove(prev => {
            const cur = prev[groupKey] || 0;
            if (cur <= 0) return prev;
            const next = { ...prev, [groupKey]: cur - 1 };
            if (next[groupKey] === 0) delete next[groupKey];

            // In edit mode, if all selections are now 0, offer to delete the order
            if (isEdit && onDeleteOrder && Object.keys(next).length === 0) {
                // Capture the initial value to restore on cancel
                const initialGroupKey = groupKey;
                const initialQty = initialData?.pickupQuantity || cur;
                Alert.alert(
                    'Șterge comanda?',
                    'Ai eliminat toate pachetele de ridicat. Dorești să ștergi această comandă de ridicare?',
                    [
                        { text: 'Anulează', style: 'cancel', onPress: () => {
                            // Restore to the original edit value
                            setPacketsToRemove({ [initialGroupKey]: initialQty });
                        }},
                        { text: 'Șterge', style: 'destructive', onPress: () => onDeleteOrder() },
                    ],
                );
            }

            return next;
        });
    };

    const formatSubscriptionLabel = (sub: any) =>
        sub.type === 'ONE_TIME'
            ? `${sub.name} — ${sub.price} RON (o singură vizită)`
            : `${sub.name} — ${sub.price} RON/lună · ${sub.visitsPerMonth}x/lună`;

    // ─── Shared field helpers ───────────────────────────────────────────
    const renderContactField = (lbl: string, placeholder: string, kbType: 'phone-pad' | 'default' = 'phone-pad') => {
        if (kbType === 'phone-pad') {
            return (
                <View style={{ marginTop: 15 }}>
                    <PhoneInputField
                        label={lbl}
                        phoneNumber={contact}
                        onPhoneNumberChange={setContact}
                        countryCode={contactCountryCode}
                        onCountryCodeChange={setContactCountryCode}
                    />
                </View>
            );
        }
        return (
            <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>{lbl}</Text>
                <TextInput
                    style={styles.input}
                    value={contact}
                    onChangeText={setContact}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                    keyboardType={kbType}
                />
            </View>
        );
    };

    const renderDetailsField = () => (
        <View style={{ marginTop: 15 }}>
            <Text style={styles.label}>Detalii Suplimentare</Text>
            <TextInput
                style={[styles.input, styles.multilineInput]}
                value={details}
                onChangeText={setDetails}
                placeholder="Alte informații..."
                placeholderTextColor="#999"
                multiline numberOfLines={4} textAlignVertical="top"
            />
        </View>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER: AMPLASARI
    // ═══════════════════════════════════════════════════════════════════════
    const renderAmplasariForm = () => (
        <>
            {/* ─── Product & Quantity ─── */}
            <Text style={styles.label}>Pachet Servicii & Cantitate</Text>
            <View style={styles.row}>
                {/* Product Dropdown */}
                <View style={[styles.productDropdownContainer]}>
                    <Pressable style={styles.dropdownButton} onPress={() => {
                        toggleDropdown(setIsPacketDropdownOpen, isPacketDropdownOpen);
                    }}>
                        <Text style={styles.dropdownText}>
                            {selectedPacket ? selectedPacket.name : 'Selectează pachet...'}
                        </Text>
                        <AntDesign name={isPacketDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                    </Pressable>
                </View>

                {/* Quantity Dropdown */}
                <View style={styles.quantityContainer}>
                    <Pressable style={styles.dropdownButton} onPress={() => {
                        toggleDropdown(setIsQuantityDropdownOpen, isQuantityDropdownOpen);
                    }}>
                        <Text style={styles.dropdownText}>{quantity}</Text>
                        <AntDesign name={isQuantityDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                    </Pressable>
                </View>
            </View>

            {/* Product Dropdown Modal */}
            <Modal visible={isPacketDropdownOpen} transparent animationType="fade" onRequestClose={() => { setIsPacketDropdownOpen(false); onDropdownToggle?.(false); }}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setIsPacketDropdownOpen(false); onDropdownToggle?.(false); }}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Selectează pachet</Text>
                        <FlatList
                            data={products}
                            keyExtractor={(item) => item.id.toString()}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item, index }) => (
                                <Pressable
                                    style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: '#F5F5F5' }]}
                                    onPress={() => { setSelectedPacket(item); setIsPacketDropdownOpen(false); onDropdownToggle?.(false); }}>
                                    <Text style={styles.dropdownItemText}>{item.name}</Text>
                                    {index < products.length - 1 && <View style={styles.divider} />}
                                </Pressable>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Quantity Dropdown Modal */}
            <Modal visible={isQuantityDropdownOpen} transparent animationType="fade" onRequestClose={() => { setIsQuantityDropdownOpen(false); onDropdownToggle?.(false); }}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setIsQuantityDropdownOpen(false); onDropdownToggle?.(false); }}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Selectează cantitate</Text>
                        <FlatList
                            data={QUANTITY_OPTIONS}
                            keyExtractor={(item) => item}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item, index }) => (
                                <Pressable
                                    style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: '#F5F5F5' }]}
                                    onPress={() => { setQuantity(item); setIsQuantityDropdownOpen(false); onDropdownToggle?.(false); }}>
                                    <Text style={styles.dropdownItemText}>{item}</Text>
                                    {index < QUANTITY_OPTIONS.length - 1 && <View style={styles.divider} />}
                                </Pressable>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Price Display */}
            {selectedPacket && (
                <Text style={styles.priceText}>
                    Preț Total: <Text style={{ fontWeight: 'bold' }}>{selectedPacket.price * parseInt(quantity)} RON</Text>
                </Text>
            )}

            {/* ─── Location ─── */}
            <LocationPicker
                onLocationSelect={(loc, existingId) => {
                    setAmpLocation(loc);
                    if (existingId) console.log('Selected existing placement:', existingId);
                }}
                initialLocation={ampLocation || undefined}
                existingPlacements={existingPlacements}
            />

            {/* ─── Contract Duration ─── */}
            <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Durata Contract</Text>
                <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <TextInput
                            style={[styles.input, isIndefinite && styles.disabledInput]}
                            value={isIndefinite ? '' : durationDays}
                            onChangeText={setDurationDays}
                            placeholder="Nr. Zile"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            editable={!isIndefinite}
                        />
                    </View>
                    <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>Nedeterminat</Text>
                        <Switch
                            trackColor={{ false: '#767577', true: '#427992' }}
                            thumbColor={isIndefinite ? '#FFFFFF' : '#f4f3f4'}
                            onValueChange={setIsIndefinite}
                            value={isIndefinite}
                        />
                    </View>
                </View>
            </View>

            {/* ─── Date ─── */}
            <DateSelector
                label="Dată Amplasare"
                initialStartDate={dateStart}
                initialEndDate={dateEnd}
                onDateChange={(s, e) => { setDateStart(s); setDateEnd(e); }}
                onToggle={(open) => { if (open) toggleDropdown(() => {}, false); }}
            />

            {/* ─── Igienizări / lună ─── */}
            <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Igienizări pe lună</Text>
                <Pressable style={styles.dropdownButton} onPress={() => {
                    toggleDropdown(setIsIgienizariDropdownOpen, isIgienizariDropdownOpen);
                }}>
                    <Text style={styles.dropdownText}>{igienizariPerMonth}</Text>
                    <AntDesign name={isIgienizariDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                </Pressable>
            </View>

            {/* Igienizări Dropdown Modal */}
            <Modal visible={isIgienizariDropdownOpen} transparent animationType="fade" onRequestClose={() => { setIsIgienizariDropdownOpen(false); onDropdownToggle?.(false); }}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setIsIgienizariDropdownOpen(false); onDropdownToggle?.(false); }}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Igienizări pe lună</Text>
                        <FlatList
                            data={IGIENIZARI_OPTIONS}
                            keyExtractor={(item) => item}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item, index }) => (
                                <Pressable
                                    style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: '#F5F5F5' }]}
                                    onPress={() => { setIgienizariPerMonth(item); setIsIgienizariDropdownOpen(false); onDropdownToggle?.(false); }}>
                                    <Text style={styles.dropdownItemText}>{item}</Text>
                                    {index < IGIENIZARI_OPTIONS.length - 1 && <View style={styles.divider} />}
                                </Pressable>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ─── Contact & Details ─── */}
            {renderContactField('Contact Șantier', 'Număr telefon')}
            {renderDetailsField()}
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER: RIDICARI
    // ═══════════════════════════════════════════════════════════════════════
    const renderRidicariForm = () => (
        <>
            <Text style={styles.label}>Selectează Pachete de Ridicat</Text>
            <View style={styles.packetListContainer}>
                {loadingPackets ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : clientPackets.length > 0 ? (
                    clientPackets.map((group) => {
                        const toRemove = packetsToRemove[group.key] || 0;
                        const available = group.availableCount;
                        const remaining = available - toRemove;
                        return (
                            <View key={group.key} style={[styles.packetRow, toRemove > 0 && styles.packetRowActive]}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={styles.packetName}>{group.productName}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <AntDesign name="environment" size={12} color="#666" style={{ marginRight: 4 }} />
                                        <Text style={styles.addressText} numberOfLines={2}>{group.address}</Text>
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
                                        onPress={() => handleDecrement(group.key)}>
                                        <AntDesign name="minus" size={16} color={toRemove === 0 ? '#ccc' : '#16283C'} />
                                    </Pressable>
                                    <View style={styles.countDisplay}>
                                        <Text style={[styles.countText, toRemove > 0 && { color: '#E53935', fontWeight: 'bold' }]}>
                                            {toRemove > 0 ? `-${toRemove}` : '0'}
                                        </Text>
                                    </View>
                                    <Pressable
                                        style={[styles.counterButton, toRemove >= available && styles.counterButtonDisabled]}
                                        onPress={() => handleIncrement(group.key, available)}>
                                        <AntDesign name="plus" size={16} color={toRemove >= available ? '#ccc' : '#16283C'} />
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

            {/* ─── Date ─── */}
            <DateSelector
                label="Dată Ridicare"
                initialStartDate={dateStart}
                onDateChange={(s) => setDateStart(s)}
            />

            {/* ─── Contact & Details ─── */}
            {renderContactField('Contact Șantier', 'Număr telefon')}
            {renderDetailsField()}
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER: IGIENIZARI
    // ═══════════════════════════════════════════════════════════════════════
    const renderIgienizariForm = () => (
        <>
            {/* ─── Subscription Dropdown ─── */}
            <Text style={styles.label}>Abonament Igienizări</Text>
            <View style={styles.subscriptionDropdownContainer}>
                <Pressable style={styles.dropdownButton} onPress={() => {
                    toggleDropdown(setIsSubscriptionDropdownOpen, isSubscriptionDropdownOpen);
                }}>
                    <Text style={[styles.dropdownText, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
                        {selectedSubscription ? formatSubscriptionLabel(selectedSubscription) : 'Selectează abonament...'}
                    </Text>
                    <AntDesign name={isSubscriptionDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                </Pressable>
            </View>

            {/* Subscription Dropdown Modal */}
            <Modal visible={isSubscriptionDropdownOpen} transparent animationType="fade" onRequestClose={() => { setIsSubscriptionDropdownOpen(false); onDropdownToggle?.(false); }}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setIsSubscriptionDropdownOpen(false); onDropdownToggle?.(false); }}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Selectează abonament</Text>
                        {loadingSubscriptions ? (
                            <ActivityIndicator size="small" color="#427992" style={{ padding: 15 }} />
                        ) : subscriptions.length === 0 ? (
                            <Text style={styles.emptyText}>Nu există abonamente active.</Text>
                        ) : (
                            <FlatList
                                data={subscriptions}
                                keyExtractor={(item) => item.id.toString()}
                                style={{ maxHeight: 400 }}
                                renderItem={({ item: sub, index }) => (
                                    <Pressable
                                        style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: '#F5F5F5' }]}
                                        onPress={() => { setSelectedSubscription(sub); setIsSubscriptionDropdownOpen(false); onDropdownToggle?.(false); }}>
                                        <Text style={styles.dropdownItemTextBold}>{sub.name}</Text>
                                        <View style={[styles.typeBadge, sub.type === 'ONE_TIME' ? styles.badgeOneTime : styles.badgeRecurring]}>
                                            <Text style={styles.typeBadgeText}>
                                                {sub.type === 'ONE_TIME' ? 'O singură dată' : 'Recurent'}
                                            </Text>
                                        </View>
                                        <Text style={styles.dropdownItemSub}>
                                            {sub.type === 'ONE_TIME'
                                                ? `${sub.price} RON`
                                                : `${sub.price} RON/lună · ${sub.visitsPerMonth} vizite/lună`}
                                        </Text>
                                        {index < subscriptions.length - 1 && <View style={styles.divider} />}
                                    </Pressable>
                                )}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ─── Location ─── */}
            <LocationPicker
                onLocationSelect={(loc) => setIgiLocation(loc)}
                initialLocation={igiLocation || undefined}
                existingPlacements={igiExistingPlacements}
            />

            {/* ─── Date ─── */}
            <DateSelector
                label={isRecurring ? "Dată Începere" : "Dată Igienizare"}
                initialStartDate={dateStart}
                onDateChange={(s) => setDateStart(s)}
                onToggle={(open) => { if (open) toggleDropdown(() => {}, false); }}
                singleDate
            />

            {/* ─── Recurring toggle (only in create mode) ─── */}
            {!isEdit && (
            <View style={{ marginTop: 15 }}>
                <View style={styles.row}>
                    <Text style={styles.label}>Igienizare Recurentă</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#427992' }}
                        thumbColor={isRecurring ? '#FFFFFF' : '#f4f3f4'}
                        onValueChange={setIsRecurring}
                        value={isRecurring}
                    />
                </View>
            </View>
            )}

            {isRecurring && !isEdit && (
                <>
                    {/* ─── Frequency (display only) ─── */}
                    <View style={{ marginTop: 15 }}>
                        <Text style={styles.label}>Frecvență</Text>
                        <Pressable style={styles.dropdownButton} onPress={() => {
                            toggleDropdown(setIsFrequencyDropdownOpen, isFrequencyDropdownOpen);
                        }}>
                            <Text style={styles.dropdownText}>
                                {frequencyDays === '7' ? 'Săptămânal (7 zile)' :
                                 frequencyDays === '14' ? 'Bisăptămânal (14 zile)' :
                                 frequencyDays === '21' ? 'La 3 săptămâni (21 zile)' :
                                 'Lunar (30 zile)'}
                            </Text>
                            <AntDesign name={isFrequencyDropdownOpen ? 'up' : 'down'} size={16} color="#16283C" />
                        </Pressable>
                    </View>

                    {/* Frequency Dropdown Modal */}
                    <Modal visible={isFrequencyDropdownOpen} transparent animationType="fade" onRequestClose={() => { setIsFrequencyDropdownOpen(false); onDropdownToggle?.(false); }}>
                        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setIsFrequencyDropdownOpen(false); onDropdownToggle?.(false); }}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Selectează frecvența</Text>
                                <FlatList
                                    data={[
                                        { value: '7', label: 'Săptămânal (7 zile)' },
                                        { value: '14', label: 'Bisăptămânal (14 zile)' },
                                        { value: '21', label: 'La 3 săptămâni (21 zile)' },
                                        { value: '30', label: 'Lunar (30 zile)' },
                                    ]}
                                    keyExtractor={(item) => item.value}
                                    renderItem={({ item, index }) => (
                                        <Pressable
                                            style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: '#F5F5F5' }]}
                                            onPress={() => { setFrequencyDays(item.value); setIsFrequencyDropdownOpen(false); onDropdownToggle?.(false); }}>
                                            <Text style={styles.dropdownItemText}>{item.label}</Text>
                                            {index < 3 && <View style={styles.divider} />}
                                        </Pressable>
                                    )}
                                />
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    {/* ─── Indefinite toggle ─── */}
                    <View style={{ marginTop: 10 }}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Nedeterminat</Text>
                            <Switch
                                trackColor={{ false: '#767577', true: '#427992' }}
                                thumbColor={recurrenceIndefinite ? '#FFFFFF' : '#f4f3f4'}
                                onValueChange={(val) => {
                                    setRecurrenceIndefinite(val);
                                    if (val) setRecurrenceEndDate('');
                                }}
                                value={recurrenceIndefinite}
                            />
                        </View>
                    </View>

                    {/* ─── Recurrence End Date (only if not indefinite) ─── */}
                    {!recurrenceIndefinite && (
                        <DateSelector
                            label="Dată Sfârșit"
                            initialStartDate={recurrenceEndDate}
                            onDateChange={(s) => setRecurrenceEndDate(s)}
                            onToggle={(open) => { if (open) toggleDropdown(() => {}, false); }}
                            singleDate
                        />
                    )}
                </>
            )}

            {/* ─── Contact & Details ─── */}
            {renderContactField('Contact Șantier', 'Număr telefon')}
            {renderDetailsField()}
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // MAIN RENDER
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <View style={[styles.container, isEdit && styles.containerEdit]}>
            {showTitle && <Text style={styles.title}>{TITLES[orderType]}</Text>}
            {orderType === 'Amplasari' && renderAmplasariForm()}
            {orderType === 'Ridicari' && renderRidicariForm()}
            {orderType === 'Igienizari' && renderIgienizariForm()}
        </View>
    );
};

export default OrderForm;

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — merged from Amplasari, Ridicari, Igienizari originals
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    // ─── Container / Titles ─────────────────────────────────────────────
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#2A3E55',
        borderRadius: 12,
        marginTop: 10,
    },
    containerEdit: {
        backgroundColor: 'transparent',
        borderRadius: 0,
        marginTop: 5,
        width: '100%',
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // ─── Dropdowns (shared) ─────────────────────────────────────────────
    dropdownButton: {
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    dropdownText: {
        color: '#16283C',
        fontSize: 14,
    },
    dropdownList: {
        position: 'absolute',
        top: 45,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        elevation: 5,
        zIndex: 1000,
        maxHeight: 200,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    dropdownItemText: {
        color: '#16283C',
        fontSize: 14,
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '100%',
    },

    // ─── Amplasari: product row ─────────────────────────────────────────
    productDropdownContainer: {
        flex: 1,
        marginRight: 10,
        position: 'relative',
    },
    quantityContainer: {
        width: 80,
        position: 'relative',
    },
    priceText: {
        color: '#4CAF50',
        marginTop: 5,
        fontSize: 14,
        marginLeft: 5,
    },

    // ─── Amplasari: contract duration ───────────────────────────────────
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchLabel: {
        color: '#FFFFFF',
        marginRight: 10,
    },

    // ─── Inputs (shared) ────────────────────────────────────────────────
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
    disabledInput: {
        backgroundColor: '#E0E0E0',
        color: '#999',
    },

    // ─── Ridicari: packet list ──────────────────────────────────────────
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

    // ─── Igienizari: subscription dropdown ──────────────────────────────
    subscriptionDropdownContainer: {
        marginBottom: 15,
        position: 'relative',
    },
    dropdownItemTextBold: {
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

    // ─── Modal dropdown ─────────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        width: '100%',
        maxHeight: '70%',
        paddingVertical: 10,
        elevation: 10,
    },
    modalTitle: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: 'bold',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
});
