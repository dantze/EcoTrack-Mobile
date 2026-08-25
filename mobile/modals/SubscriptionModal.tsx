import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    SubscriptionService, Subscription, CreateSubscriptionRequest, SubscriptionType,
} from '../services/SubscriptionService';
import { validateRequired, validatePositiveNumber, validatePositiveInt } from '../utils/formatters';
import { StyleSheet } from 'react-native';

interface SubscriptionModalProps {
    visible: boolean;
    editingSub: Subscription | null;
    subName: string;
    subDescription: string;
    subType: SubscriptionType;
    subPrice: string;
    subVisits: string;
    subDuration: string;
    subIsIndefinite: boolean;
    onChangeSubName: (v: string) => void;
    onChangeSubDescription: (v: string) => void;
    onChangeSubType: (v: SubscriptionType) => void;
    onChangeSubPrice: (v: string) => void;
    onChangeSubVisits: (v: string) => void;
    onChangeSubDuration: (v: string) => void;
    onChangeSubIsIndefinite: (v: boolean) => void;
    onClose: () => void;
    onSaved: (sub: Subscription) => void;
    onToggleActive: (sub: Subscription) => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
    visible, editingSub,
    subName, subDescription, subType, subPrice, subVisits, subDuration, subIsIndefinite,
    onChangeSubName, onChangeSubDescription, onChangeSubType,
    onChangeSubPrice, onChangeSubVisits, onChangeSubDuration, onChangeSubIsIndefinite,
    onClose, onSaved, onToggleActive,
}) => {
    const [saving, setSaving] = useState(false);

    const validate = (): boolean => {
        const nameErr = validateRequired(subName, 'Numele abonamentului');
        if (nameErr) { Alert.alert('Eroare', nameErr); return false; }
        const priceErr = validatePositiveNumber(subPrice, 'Prețul');
        if (priceErr) { Alert.alert('Eroare', priceErr); return false; }
        if (subType === 'RECURRING') {
            const visitsErr = validatePositiveInt(subVisits, 'Numărul de vizite/lună');
            if (visitsErr) { Alert.alert('Eroare', visitsErr); return false; }
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const payload: CreateSubscriptionRequest = {
                name: subName.trim(),
                description: subDescription.trim() || null,
                type: subType,
                price: parseFloat(subPrice),
                visitsPerMonth: subType === 'RECURRING' ? parseInt(subVisits) : null,
                durationMonths: (subType === 'RECURRING' && !subIsIndefinite && subDuration.trim())
                    ? parseInt(subDuration) : null,
                isIndefinite: subType === 'RECURRING' ? subIsIndefinite : null,
                isActive: true,
            };
            if (editingSub) {
                const updated = await SubscriptionService.updateSubscription(editingSub.id, payload);
                onSaved(updated);
                Alert.alert('Succes', 'Abonamentul a fost actualizat!');
            } else {
                const created = await SubscriptionService.createSubscription(payload);
                onSaved(created);
                Alert.alert('Succes', 'Abonamentul a fost adăugat!');
            }
            onClose();
        } catch (e: any) {
            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
        } finally { setSaving(false); }
    };

    const handleToggleActive = () => {
        if (!editingSub) return;
        const isActive = editingSub.isActive;
        Alert.alert(
            isActive ? 'Dezactivează Abonament' : 'Reactivează Abonament',
            isActive
                ? `Abonamentul "${editingSub.name}" va fi dezactivat. Comenzile existente nu sunt afectate.`
                : `Abonamentul "${editingSub.name}" va fi reactivat.`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: isActive ? 'Dezactivează' : 'Reactivează',
                    style: isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            if (isActive) {
                                await SubscriptionService.deactivateSubscription(editingSub.id);
                                onToggleActive({ ...editingSub, isActive: false });
                            } else {
                                const updated = await SubscriptionService.updateSubscription(editingSub.id, {
                                    name: editingSub.name,
                                    description: editingSub.description,
                                    type: editingSub.type,
                                    price: editingSub.price,
                                    visitsPerMonth: editingSub.visitsPerMonth,
                                    durationMonths: editingSub.durationMonths,
                                    isIndefinite: editingSub.isIndefinite,
                                    isActive: true,
                                });
                                onToggleActive(updated);
                            }
                            onClose();
                        } catch (e: any) {
                            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
                        } finally { setSaving(false); }
                    },
                },
            ]
        );
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {editingSub ? 'Editare Abonament' : 'Abonament Nou'}
                        </Text>
                        <Pressable onPress={onClose}>
                            <AntDesign name="close" size={24} color="#666" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Nume Abonament *</Text>
                            <TextInput
                                style={styles.textInput} value={subName}
                                onChangeText={onChangeSubName}
                                placeholder="Ex: Igienizare Lunară" placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Descriere (opțional)</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                value={subDescription} onChangeText={onChangeSubDescription}
                                placeholder="Descriere..." placeholderTextColor="#999"
                                multiline numberOfLines={3} textAlignVertical="top"
                            />
                        </View>

                        {/* Type selector */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Tip Abonament *</Text>
                            <View style={styles.typeSelector}>
                                <Pressable
                                    style={[styles.typeOption, subType === 'ONE_TIME' && styles.typeOptionActive]}
                                    onPress={() => onChangeSubType('ONE_TIME')}
                                >
                                    <Ionicons name="flash" size={16} color={subType === 'ONE_TIME' ? '#FFF' : '#7B5EA7'} />
                                    <Text style={[styles.typeOptionText, subType === 'ONE_TIME' && styles.typeOptionTextActive]}>
                                        O singură dată
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.typeOption, subType === 'RECURRING' && styles.typeOptionActive]}
                                    onPress={() => onChangeSubType('RECURRING')}
                                >
                                    <MaterialCommunityIcons name="refresh" size={16} color={subType === 'RECURRING' ? '#FFF' : '#7B5EA7'} />
                                    <Text style={[styles.typeOptionText, subType === 'RECURRING' && styles.typeOptionTextActive]}>
                                        Recurent
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Preț (RON) *</Text>
                            <TextInput
                                style={styles.textInput} value={subPrice}
                                onChangeText={onChangeSubPrice}
                                placeholder="Ex: 200" placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Recurring-only fields */}
                        {subType === 'RECURRING' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Vizite / Lună *</Text>
                                    <TextInput
                                        style={styles.textInput} value={subVisits}
                                        onChangeText={onChangeSubVisits}
                                        placeholder="Ex: 2" placeholderTextColor="#999"
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <View style={styles.switchRow}>
                                        <Text style={styles.inputLabel}>Durată nedefinită</Text>
                                        <Switch
                                            value={subIsIndefinite}
                                            onValueChange={onChangeSubIsIndefinite}
                                            trackColor={{ false: '#E0E0E0', true: '#7B5EA7' }}
                                            thumbColor="#FFF"
                                        />
                                    </View>
                                    {!subIsIndefinite && (
                                        <>
                                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Durata (luni)</Text>
                                            <TextInput
                                                style={styles.textInput} value={subDuration}
                                                onChangeText={onChangeSubDuration}
                                                placeholder="Ex: 12 (lasă gol pentru nedefinit)"
                                                placeholderTextColor="#999" keyboardType="numeric"
                                            />
                                        </>
                                    )}
                                </View>
                            </>
                        )}
                    </ScrollView>

                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            { backgroundColor: '#7B5EA7' },
                            pressed && styles.saveButtonPressed,
                            saving && styles.saveButtonDisabled,
                        ]}
                        onPress={handleSave} disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <>
                                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Salvează Abonament</Text>
                            </>
                        }
                    </Pressable>

                    {editingSub && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.deleteButton,
                                { backgroundColor: editingSub.isActive ? '#E53935' : '#4CAF50' },
                                pressed && styles.deleteButtonPressed,
                                saving && styles.saveButtonDisabled,
                            ]}
                            onPress={handleToggleActive} disabled={saving}
                        >
                            <Ionicons
                                name={editingSub.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                                size={20} color="#FFF" style={{ marginRight: 8 }}
                            />
                            <Text style={styles.deleteButtonText}>
                                {editingSub.isActive ? 'Dezactivează' : 'Reactivează'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default SubscriptionModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 20, paddingBottom: 30, maxHeight: '88%',
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 16,
    },
    title: { fontSize: 22, fontWeight: 'bold', color: '#16283C' },
    formContainer: { paddingHorizontal: 20 },
    inputGroup: { marginBottom: 18 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#16283C', marginBottom: 8 },
    textInput: {
        backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15,
        paddingVertical: 12, fontSize: 15, color: '#16283C',
        borderWidth: 1, borderColor: '#E0E0E0',
    },
    textArea: { height: 90, textAlignVertical: 'top' },
    typeSelector: { flexDirection: 'row', gap: 10 },
    typeOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 10,
        borderWidth: 2, borderColor: '#7B5EA7', backgroundColor: '#FFF',
    },
    typeOptionActive: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
    typeOptionText: { color: '#7B5EA7', fontWeight: '600', fontSize: 14 },
    typeOptionTextActive: { color: '#FFF' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButton: {
        flexDirection: 'row', backgroundColor: '#5D8AA8', paddingVertical: 15,
        marginHorizontal: 20, borderRadius: 12, alignItems: 'center',
        justifyContent: 'center', marginTop: 10,
    },
    saveButtonPressed: { backgroundColor: '#4A7A96' },
    saveButtonDisabled: { backgroundColor: '#BDC3C7' },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    deleteButton: {
        flexDirection: 'row', backgroundColor: '#E53935', paddingVertical: 12,
        marginHorizontal: 20, borderRadius: 12, alignItems: 'center',
        justifyContent: 'center', marginTop: 10,
    },
    deleteButtonPressed: { backgroundColor: '#C62828' },
    deleteButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});
