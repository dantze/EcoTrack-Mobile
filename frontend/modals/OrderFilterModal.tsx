import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    TextInput,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/Colors';

// ─── Filter state shape ──────────────────────────────────────────────────────
export interface OrderFilters {
    city: string;
    orderType: string; // '' | 'Amplasari' | 'Ridicari' | 'Igienizari'
    productName: string;
    startDate: string; // dd/mm/yyyy or ''
    endDate: string;   // dd/mm/yyyy or ''
}

export const EMPTY_FILTERS: OrderFilters = {
    city: '',
    orderType: '',
    productName: '',
    startDate: '',
    endDate: '',
};

export const hasActiveFilters = (f: OrderFilters): boolean =>
    !!(f.city || f.orderType || f.productName || f.startDate || f.endDate);

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
    visible: boolean;
    onClose: () => void;
    filters: OrderFilters;
    onApply: (filters: OrderFilters) => void;
    /** Unique product names extracted from orders so the user can pick one. */
    productNames: string[];
}

const ORDER_TYPES = [
    { value: 'Amplasari', label: 'Amplasare' },
    { value: 'Ridicari', label: 'Ridicare' },
    { value: 'Igienizari', label: 'Igienizare' },
];

const OrderFilterModal: React.FC<Props> = ({
    visible,
    onClose,
    filters,
    onApply,
    productNames,
}) => {
    const [local, setLocal] = useState<OrderFilters>(filters);

    // Sync when parent filters change (e.g. reset from outside)
    useEffect(() => {
        setLocal(filters);
    }, [filters]);

    const handleApply = () => {
        onApply(local);
        onClose();
    };

    const handleReset = () => {
        setLocal(EMPTY_FILTERS);
        onApply(EMPTY_FILTERS);
        onClose();
    };

    const toggleOrderType = (type: string) => {
        setLocal((prev) => ({
            ...prev,
            orderType: prev.orderType === type ? '' : type,
        }));
    };

    const toggleProduct = (name: string) => {
        setLocal((prev) => ({
            ...prev,
            productName: prev.productName === name ? '' : name,
        }));
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Filtrează comenzi</Text>
                        <Pressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={AppColors.textWhite} />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
                        {/* ── City ──────────────────────────────────────── */}
                        <Text style={styles.sectionLabel}>Oraș (din adresă)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ex: București, Cluj..."
                            placeholderTextColor={AppColors.placeholderText}
                            value={local.city}
                            onChangeText={(t) => setLocal((p) => ({ ...p, city: t }))}
                        />

                        {/* ── Order type ───────────────────────────────── */}
                        <Text style={styles.sectionLabel}>Tip comandă</Text>
                        <View style={styles.chipRow}>
                            {ORDER_TYPES.map((ot) => {
                                const active = local.orderType === ot.value;
                                return (
                                    <Pressable
                                        key={ot.value}
                                        style={[styles.chip, active && styles.chipActive]}
                                        onPress={() => toggleOrderType(ot.value)}
                                    >
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                            {ot.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* ── Product ──────────────────────────────────── */}
                        <Text style={styles.sectionLabel}>Produs</Text>
                        {productNames.length === 0 ? (
                            <Text style={styles.hint}>Niciun produs disponibil</Text>
                        ) : (
                            <View style={styles.chipRow}>
                                {productNames.map((name) => {
                                    const active = local.productName === name;
                                    return (
                                        <Pressable
                                            key={name}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleProduct(name)}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                                {name}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {/* ── Date range ────────────────────────────────── */}
                        <Text style={styles.sectionLabel}>Perioadă</Text>
                        <View style={styles.dateRangeRow}>
                            <View style={styles.dateInputWrapper}>
                                <Text style={styles.dateLabel}>De la</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="zz/ll/aaaa"
                                    placeholderTextColor={AppColors.placeholderText}
                                    value={local.startDate}
                                    onChangeText={(t) => {
                                        const digits = t.replace(/[^0-9]/g, '').slice(0, 8);
                                        let formatted = digits;
                                        if (digits.length > 4) {
                                            formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        } else if (digits.length > 2) {
                                            formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        }
                                        setLocal((p) => ({ ...p, startDate: formatted }));
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={10}
                                />
                            </View>
                            <View style={styles.dateInputWrapper}>
                                <Text style={styles.dateLabel}>Până la</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="zz/ll/aaaa"
                                    placeholderTextColor={AppColors.placeholderText}
                                    value={local.endDate}
                                    onChangeText={(t) => {
                                        const digits = t.replace(/[^0-9]/g, '').slice(0, 8);
                                        let formatted = digits;
                                        if (digits.length > 4) {
                                            formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                                        } else if (digits.length > 2) {
                                            formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                                        }
                                        setLocal((p) => ({ ...p, endDate: formatted }));
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={10}
                                />
                            </View>
                        </View>
                        <Text style={styles.hint}>
                            Vor fi afișate comenzile din intervalul selectat
                        </Text>

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Footer buttons */}
                    <View style={styles.footer}>
                        <Pressable
                            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
                            onPress={handleReset}
                        >
                            <Text style={styles.resetBtnText}>Resetează</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.9 }]}
                            onPress={handleApply}
                        >
                            <Text style={styles.applyBtnText}>Aplică</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default OrderFilterModal;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: AppColors.modalOverlay,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: AppColors.modalBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingTop: 20,
        paddingBottom: 30,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: AppColors.textWhite,
    },
    body: {
        paddingHorizontal: 20,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: AppColors.accentColor,
        marginBottom: 8,
        marginTop: 16,
    },
    textInput: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: AppColors.textWhite,
        borderWidth: 1,
        borderColor: '#2A4A65',
    },
    hint: {
        color: AppColors.placeholderText,
        fontSize: 12,
        marginTop: 6,
    },
    dateRangeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    dateInputWrapper: {
        flex: 1,
    },
    dateLabel: {
        color: AppColors.lightText,
        fontSize: 12,
        marginBottom: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: AppColors.inputBackground,
        borderWidth: 1,
        borderColor: '#2A4A65',
    },
    chipActive: {
        backgroundColor: AppColors.buttonBackground,
        borderColor: AppColors.buttonBackground,
    },
    chipText: {
        color: AppColors.lightText,
        fontSize: 14,
        fontWeight: '500',
    },
    chipTextActive: {
        color: AppColors.textWhite,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 12,
    },
    resetBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.accentColor,
        alignItems: 'center',
    },
    resetBtnText: {
        color: AppColors.accentColor,
        fontSize: 15,
        fontWeight: '600',
    },
    applyBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: AppColors.buttonBackground,
        alignItems: 'center',
    },
    applyBtnText: {
        color: AppColors.textWhite,
        fontSize: 15,
        fontWeight: 'bold',
    },
});
