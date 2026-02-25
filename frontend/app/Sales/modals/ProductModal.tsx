import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { ProductService, Product } from '../../../services/ProductService';
import { validateRequired, validatePositiveNumber } from '../../../utils/formatters';
import modalStyles from './modalStyles';

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
            <View style={modalStyles.overlay}>
                <View style={modalStyles.content}>
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>
                            {editingProduct ? 'Editare Produs' : 'Produs Nou'}
                        </Text>
                        <Pressable onPress={onClose}>
                            <AntDesign name="close" size={24} color="#666" />
                        </Pressable>
                    </View>

                    <ScrollView style={modalStyles.formContainer} keyboardShouldPersistTaps="handled">
                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Nume Produs *</Text>
                            <TextInput
                                style={modalStyles.textInput} value={productName}
                                onChangeText={onChangeProductName}
                                placeholder="Ex: Toaletă Ecologică Standard"
                                placeholderTextColor="#999"
                            />
                        </View>
                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Descriere (opțional)</Text>
                            <TextInput
                                style={[modalStyles.textInput, modalStyles.textArea]}
                                value={productDescription} onChangeText={onChangeProductDescription}
                                placeholder="Descriere detaliată..."
                                placeholderTextColor="#999" multiline numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>
                        <View style={modalStyles.inputGroup}>
                            <Text style={modalStyles.inputLabel}>Preț (RON) *</Text>
                            <TextInput
                                style={modalStyles.textInput} value={productPrice}
                                onChangeText={onChangeProductPrice}
                                placeholder="Ex: 150" placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>
                    </ScrollView>

                    <Pressable
                        style={({ pressed }) => [
                            modalStyles.saveButton,
                            { backgroundColor: '#5D8AA8' },
                            pressed && modalStyles.saveButtonPressed,
                            saving && modalStyles.saveButtonDisabled,
                        ]}
                        onPress={handleSave} disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <>
                                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={modalStyles.saveButtonText}>Salvează Produs</Text>
                            </>
                        }
                    </Pressable>

                    {editingProduct && (
                        <Pressable
                            style={({ pressed }) => [
                                modalStyles.deleteButton,
                                { backgroundColor: '#E53935' },
                                pressed && modalStyles.deleteButtonPressed,
                                saving && modalStyles.saveButtonDisabled,
                            ]}
                            onPress={handleDelete} disabled={saving}
                        >
                            <Ionicons name="trash-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={modalStyles.deleteButtonText}>Șterge Produs</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default ProductModal;
