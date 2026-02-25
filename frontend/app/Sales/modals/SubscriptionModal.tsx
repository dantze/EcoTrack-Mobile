import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    SubscriptionService, Subscription, CreateSubscriptionRequest, SubscriptionType,
} from '../../../services/SubscriptionService';
import { validateRequired, validatePositiveNumber, validatePositiveInt } from '../../../utils/formatters';
import modalStyles from './modalStyles';

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
            <View style={modalStyles.overlay}>
                <View style={modalStyles.content}>
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>
                            {editingSub ? 'Editare Abonament' : 'Abonament Nou'}
                        </Text>
                        <Pressable onPress={onClose}>
                            <AntDesign name="close" size={24} color="#666" />
                        </Pressable>
                    </View>

                    <ScrollView style={modalStyles.formContainer} keyboardShouldPersistTaps="handled">
                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Nume Abonament *</Text>
                            <TextInput
                                style={modalStyles.textInput} value={subName}
                                onChangeText={onChangeSubName}
                                placeholder="Ex: Igienizare Lunară" placeholderTextColor="#999"
                            />
                        </View>

                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Descriere (opțional)</Text>
                            <TextInput
                                style={[modalStyles.textInput, modalStyles.textArea]}
                                value={subDescription} onChangeText={onChangeSubDescription}
                                placeholder="Descriere..." placeholderTextColor="#999"
                                multiline numberOfLines={3} textAlignVertical="top"
                            />
                        </View>

                        {/* Type selector */}
                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Tip Abonament *</Text>
                            <View style={modalStyles.typeSelector}>
                                <Pressable
                                    style={[modalStyles.typeOption, subType === 'ONE_TIME' && modalStyles.typeOptionActive]}
                                    onPress={() => onChangeSubType('ONE_TIME')}
                                >
                                    <Ionicons name="flash" size={16} color={subType === 'ONE_TIME' ? '#FFF' : '#7B5EA7'} />
                                    <Text style={[modalStyles.typeOptionText, subType === 'ONE_TIME' && modalStyles.typeOptionTextActive]}>
                                        O singură dată
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[modalStyles.typeOption, subType === 'RECURRING' && modalStyles.typeOptionActive]}
                                    onPress={() => onChangeSubType('RECURRING')}
                                >
                                    <MaterialCommunityIcons name="refresh" size={16} color={subType === 'RECURRING' ? '#FFF' : '#7B5EA7'} />
                                    <Text style={[modalStyles.typeOptionText, subType === 'RECURRING' && modalStyles.typeOptionTextActive]}>
                                        Recurent
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Preț (RON) *</Text>
                            <TextInput
                                style={modalStyles.textInput} value={subPrice}
                                onChangeText={onChangeSubPrice}
                                placeholder="Ex: 200" placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Recurring-only fields */}
                        {subType === 'RECURRING' && (
                            <>
                                <View style={modalStyles.inputGroup}>
                                    <Text style={modalStyles.inputLabel}>Vizite / Lună *</Text>
                                    <TextInput
                                        style={modalStyles.textInput} value={subVisits}
                                        onChangeText={onChangeSubVisits}
                                        placeholder="Ex: 2" placeholderTextColor="#999"
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={modalStyles.inputGroup}>
                                    <View style={modalStyles.switchRow}>
                                        <Text style={modalStyles.inputLabel}>Durată nedefinită</Text>
                                        <Switch
                                            value={subIsIndefinite}
                                            onValueChange={onChangeSubIsIndefinite}
                                            trackColor={{ false: '#E0E0E0', true: '#7B5EA7' }}
                                            thumbColor="#FFF"
                                        />
                                    </View>
                                    {!subIsIndefinite && (
                                        <>
                                            <Text style={[modalStyles.inputLabel, { marginTop: 12 }]}>Durata (luni)</Text>
                                            <TextInput
                                                style={modalStyles.textInput} value={subDuration}
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
                            modalStyles.saveButton,
                            { backgroundColor: '#7B5EA7' },
                            pressed && modalStyles.saveButtonPressed,
                            saving && modalStyles.saveButtonDisabled,
                        ]}
                        onPress={handleSave} disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <>
                                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={modalStyles.saveButtonText}>Salvează Abonament</Text>
                            </>
                        }
                    </Pressable>

                    {editingSub && (
                        <Pressable
                            style={({ pressed }) => [
                                modalStyles.deleteButton,
                                { backgroundColor: editingSub.isActive ? '#E53935' : '#4CAF50' },
                                pressed && modalStyles.deleteButtonPressed,
                                saving && modalStyles.saveButtonDisabled,
                            ]}
                            onPress={handleToggleActive} disabled={saving}
                        >
                            <Ionicons
                                name={editingSub.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                                size={20} color="#FFF" style={{ marginRight: 8 }}
                            />
                            <Text style={modalStyles.deleteButtonText}>
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
