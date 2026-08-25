import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { ProductService, Product } from '../services/ProductService';
import { validateRequired, validatePositiveNumber } from '../utils/formatters';

interface ProductModalProps {
    visible: boolean;
    editingProduct: Product | null;
    productName: string;
    productDescription: string;
    productPrice: string;
    onChangeProductName: (v: string) => void;
    onChangeProductDescription: (v: string) => void;
    onChangeProductPrice: (v: string) => void;
    onClose: () => void;
    onSaved: (product: Product) => void;
    onDeleted: (productId: number) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({
    visible, editingProduct,
    productName, productDescription, productPrice,
    onChangeProductName, onChangeProductDescription, onChangeProductPrice,
    onClose, onSaved, onDeleted,
}) => {
    const [saving, setSaving] = useState(false);

    const validate = (): boolean => {
        const nameErr = validateRequired(productName, 'Numele produsului');
        if (nameErr) { Alert.alert('Eroare', nameErr); return false; }
        const priceErr = validatePositiveNumber(productPrice, 'Prețul');
        if (priceErr) { Alert.alert('Eroare', priceErr); return false; }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                name: productName.trim(),
                description: productDescription.trim() || null,
                price: parseFloat(productPrice),
            };
            if (editingProduct) {
                const updated = await ProductService.updateProduct(editingProduct.id, payload);
                onSaved(updated);
                Alert.alert('Succes', 'Produsul a fost actualizat!');
            } else {
                const created = await ProductService.createProduct(payload);
                onSaved(created);
                Alert.alert('Succes', 'Produsul a fost adăugat!');
            }
            onClose();
        } catch (e: any) {
            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (!editingProduct) return;
        Alert.alert('Șterge Produs', `Sigur dorești să ștergi "${editingProduct.name}"?`, [
            { text: 'Anulează', style: 'cancel' },
            {
                text: 'Șterge', style: 'destructive',
                onPress: async () => {
                    setSaving(true);
                    try {
                        const result = await ProductService.deleteProduct(editingProduct.id);
                        if (result.success) {
                            onDeleted(editingProduct.id);
                            onClose();
                            Alert.alert('Succes', 'Produsul a fost șters!');
                        } else {
                            Alert.alert('Nu se poate șterge', result.error || 'Eroare la ștergere.');
                        }
                    } catch {
                        Alert.alert('Eroare', 'Eroare de conexiune.');
                    } finally { setSaving(false); }
                },
            },
        ]);
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {editingProduct ? 'Editare Produs' : 'Produs Nou'}
                        </Text>
                        <Pressable onPress={onClose}>
                            <AntDesign name="close" size={24} color="#666" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Nume Produs *</Text>
                            <TextInput
                                style={styles.textInput} value={productName}
                                onChangeText={onChangeProductName}
                                placeholder="Ex: Toaletă Ecologică Standard"
                                placeholderTextColor="#999"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Descriere (opțional)</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                value={productDescription} onChangeText={onChangeProductDescription}
                                placeholder="Descriere detaliată..."
                                placeholderTextColor="#999" multiline numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Preț (RON) *</Text>
                            <TextInput
                                style={styles.textInput} value={productPrice}
                                onChangeText={onChangeProductPrice}
                                placeholder="Ex: 150" placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>
                    </ScrollView>

                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            { backgroundColor: '#5D8AA8' },
                            pressed && styles.saveButtonPressed,
                            saving && styles.saveButtonDisabled,
                        ]}
                        onPress={handleSave} disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <>
                                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Salvează Produs</Text>
                            </>
                        }
                    </Pressable>

                    {editingProduct && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.deleteButton,
                                { backgroundColor: '#E53935' },
                                pressed && styles.deleteButtonPressed,
                                saving && styles.saveButtonDisabled,
                            ]}
                            onPress={handleDelete} disabled={saving}
                        >
                            <Ionicons name="trash-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.deleteButtonText}>Șterge Produs</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default ProductModal;

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
