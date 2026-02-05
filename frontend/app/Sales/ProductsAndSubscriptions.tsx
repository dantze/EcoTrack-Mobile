import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons, AntDesign, MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/ApiConfig';

interface Product {
    id: number;
    name: string;
    description: string | null;
    price: number;
}

const ProductsAndSubscriptions = () => {
    const router = useRouter();

    // Products state
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form state
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [productPrice, setProductPrice] = useState('');

    // Fetch products
    const fetchProducts = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/products`);
            if (response.ok) {
                const data = await response.json();
                setProducts(data);
            } else {
                console.error('Failed to fetch products');
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchProducts();
    };

    const resetForm = () => {
        setProductName('');
        setProductDescription('');
        setProductPrice('');
        setEditingProduct(null);
    };

    const openAddModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setProductName(product.name);
        setProductDescription(product.description || '');
        setProductPrice(product.price.toString());
        setModalVisible(true);
    };

    const validateForm = () => {
        if (!productName.trim()) {
            Alert.alert('Eroare', 'Numele produsului este obligatoriu.');
            return false;
        }
        if (!productPrice.trim()) {
            Alert.alert('Eroare', 'Prețul produsului este obligatoriu.');
            return false;
        }
        const price = parseFloat(productPrice);
        if (isNaN(price) || price < 0) {
            Alert.alert('Eroare', 'Prețul trebuie să fie un număr valid pozitiv.');
            return false;
        }
        return true;
    };

    const handleSaveProduct = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const payload = {
                name: productName.trim(),
                description: productDescription.trim() || null,
                price: parseFloat(productPrice)
            };

            const isEditing = editingProduct !== null;
            const url = isEditing
                ? `${API_BASE_URL}/products/${editingProduct.id}`
                : `${API_BASE_URL}/products`;
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const savedProduct = await response.json();
                if (isEditing) {
                    setProducts(prev => prev.map(p => p.id === savedProduct.id ? savedProduct : p));
                    Alert.alert('Succes', 'Produsul a fost actualizat cu succes!');
                } else {
                    setProducts(prev => [...prev, savedProduct]);
                    Alert.alert('Succes', 'Produsul a fost adăugat cu succes!');
                }
                setModalVisible(false);
                resetForm();
            } else {
                Alert.alert('Eroare', 'Nu am putut salva produsul. Încearcă din nou.');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            Alert.alert('Eroare', 'Eroare de conexiune. Verifică conexiunea la internet.');
        } finally {
            setSaving(false);
        }
    };

    const formatPrice = (price: number) => {
        return price.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' RON';
    };

    const handleDeleteProduct = () => {
        if (!editingProduct) return;

        Alert.alert(
            'Șterge Produs',
            `Sigur dorești să ștergi produsul "${editingProduct.name}"?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Șterge',
                    style: 'destructive',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            const response = await fetch(`${API_BASE_URL}/products/${editingProduct.id}`, {
                                method: 'DELETE',
                            });

                            if (response.ok || response.status === 204) {
                                setProducts(prev => prev.filter(p => p.id !== editingProduct.id));
                                setModalVisible(false);
                                resetForm();
                                Alert.alert('Succes', 'Produsul a fost șters cu succes!');
                            } else if (response.status === 409) {
                                // Product is in use by orders
                                const data = await response.json();
                                Alert.alert('Nu se poate șterge', data.error || 'Produsul este folosit în comenzi existente.');
                            } else {
                                Alert.alert('Eroare', 'Nu am putut șterge produsul. Încearcă din nou.');
                            }
                        } catch (error) {
                            console.error('Error deleting product:', error);
                            Alert.alert('Eroare', 'Eroare de conexiune.');
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Produse și Abonamente</Text>
            </View>

            {/* Add Product Button */}
            <View style={styles.actionContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.addButton,
                        pressed && styles.addButtonPressed
                    ]}
                    onPress={openAddModal}
                >
                    <AntDesign name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.addButtonText}>Adaugă Produs</Text>
                </Pressable>

                <Pressable
                    style={styles.refreshButton}
                    onPress={handleRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color="#5D8AA8" />
                    ) : (
                        <Ionicons name="refresh" size={22} color="#5D8AA8" />
                    )}
                </Pressable>
            </View>

            {/* Products List */}
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#5D8AA8" />
                        <Text style={styles.loadingText}>Se încarcă produsele...</Text>
                    </View>
                ) : products.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="inventory" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>Nu există produse încă</Text>
                        <Text style={styles.emptySubtext}>Apasă pe "Adaugă Produs" pentru a crea primul produs.</Text>
                    </View>
                ) : (
                    products.map((product) => (
                        <Pressable
                            key={product.id}
                            style={({ pressed }) => [
                                styles.productCard,
                                pressed && styles.productCardPressed
                            ]}
                            onPress={() => openEditModal(product)}
                        >
                            <View style={styles.productInfo}>
                                <Text style={styles.productName}>{product.name}</Text>
                                {product.description && (
                                    <Text style={styles.productDescription} numberOfLines={2}>
                                        {product.description}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.cardRight}>
                                <View style={styles.priceContainer}>
                                    <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" style={{ marginLeft: 8 }} />
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>

            {/* Add Product Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingProduct ? 'Editare Produs' : 'Produs Nou'}</Text>
                            <Pressable
                                style={styles.closeButton}
                                onPress={() => {
                                    setModalVisible(false);
                                    resetForm();
                                }}
                            >
                                <AntDesign name="close" size={24} color="#666" />
                            </Pressable>
                        </View>

                        {/* Form */}
                        <ScrollView
                            style={styles.formContainer}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Name Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Nume Produs *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={productName}
                                    onChangeText={setProductName}
                                    placeholder="Ex: Toaletă Ecologică Standard"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Description Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Descriere (opțional)</Text>
                                <TextInput
                                    style={[styles.textInput, styles.textArea]}
                                    value={productDescription}
                                    onChangeText={setProductDescription}
                                    placeholder="Descriere detaliată a produsului..."
                                    placeholderTextColor="#999"
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Price Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Preț (RON) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={productPrice}
                                    onChangeText={setProductPrice}
                                    placeholder="Ex: 150"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                />
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.saveButton,
                                pressed && styles.saveButtonPressed,
                                saving && styles.saveButtonDisabled
                            ]}
                            onPress={handleSaveProduct}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.saveButtonText}>Salvează Produs</Text>
                                </>
                            )}
                        </Pressable>

                        {/* Delete Button - only shown when editing */}
                        {editingProduct && (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.deleteButton,
                                    pressed && styles.deleteButtonPressed,
                                    saving && styles.saveButtonDisabled
                                ]}
                                onPress={handleDeleteProduct}
                                disabled={saving}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.deleteButtonText}>Șterge Produs</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    )
}

export default ProductsAndSubscriptions

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
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
        fontSize: 22,
        fontWeight: 'bold',
    },
    actionContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
    },
    addButtonPressed: {
        backgroundColor: '#388E3C',
    },
    addButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    refreshButton: {
        marginLeft: 12,
        width: 48,
        height: 48,
        backgroundColor: 'rgba(93, 138, 168, 0.2)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    loadingText: {
        color: '#999',
        marginTop: 15,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
    },
    emptySubtext: {
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 10,
        paddingHorizontal: 40,
    },
    // Product Card
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#2A3E55',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    productInfo: {
        flex: 1,
        marginRight: 10,
    },
    productName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    productDescription: {
        color: '#AAA',
        fontSize: 13,
        marginTop: 4,
    },
    priceContainer: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    productPrice: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: 'bold',
    },
    productCardPressed: {
        backgroundColor: '#354D67',
    },
    cardRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingBottom: 30,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#16283C',
    },
    closeButton: {
        padding: 5,
    },
    formContainer: {
        paddingHorizontal: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16283C',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: '#16283C',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: '#5D8AA8',
        paddingVertical: 15,
        marginHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    saveButtonPressed: {
        backgroundColor: '#4A7A96',
    },
    saveButtonDisabled: {
        backgroundColor: '#BDC3C7',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    deleteButton: {
        flexDirection: 'row',
        backgroundColor: '#E53935',
        paddingVertical: 12,
        marginHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    deleteButtonPressed: {
        backgroundColor: '#C62828',
    },
    deleteButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
})
