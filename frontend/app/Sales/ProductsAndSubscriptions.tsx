import {
    StyleSheet, Text, View, Pressable, ScrollView,
    TextInput, Modal, ActivityIndicator, Alert, Switch
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons, AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProductService, Product } from '../../services/ProductService';
import {
    SubscriptionService, Subscription, CreateSubscriptionRequest, SubscriptionType
} from '../../services/SubscriptionService';

// ─── Tab type ────────────────────────────────────────────────────────────────
type ActiveTab = 'products' | 'subscriptions';

const ProductsAndSubscriptions = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ActiveTab>('products');

    // ─── Products state ──────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);

    const [productModalVisible, setProductModalVisible] = useState(false);
    const [savingProduct, setSavingProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [productPrice, setProductPrice] = useState('');

    // ─── Subscriptions state ─────────────────────────────────────────────────
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [subsLoading, setSubsLoading] = useState(true);

    const [subModalVisible, setSubModalVisible] = useState(false);
    const [savingSub, setSavingSub] = useState(false);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);
    const [subName, setSubName] = useState('');
    const [subDescription, setSubDescription] = useState('');
    const [subType, setSubType] = useState<SubscriptionType>('ONE_TIME');
    const [subPrice, setSubPrice] = useState('');
    const [subVisits, setSubVisits] = useState('');
    const [subDuration, setSubDuration] = useState('');
    const [subIsIndefinite, setSubIsIndefinite] = useState(false);

    // ─── Fetch products ──────────────────────────────────────────────────────
    const fetchProducts = useCallback(async () => {
        try {
            const data = await ProductService.getAllProducts();
            setProducts(data);
        } catch (e) {
            console.error('Error fetching products:', e);
        } finally {
            setProductsLoading(false);
        }
    }, []);

    // ─── Fetch subscriptions ─────────────────────────────────────────────────
    const fetchSubscriptions = useCallback(async () => {
        try {
            const data = await SubscriptionService.getAllSubscriptions();
            setSubscriptions(data);
        } catch (e) {
            console.error('Error fetching subscriptions:', e);
        } finally {
            setSubsLoading(false);
        }
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

    // ─── Product helpers ─────────────────────────────────────────────────────
    const resetProductForm = () => {
        setProductName(''); setProductDescription(''); setProductPrice('');
        setEditingProduct(null);
    };

    const openAddProduct = () => { resetProductForm(); setProductModalVisible(true); };
    const openEditProduct = (p: Product) => {
        setEditingProduct(p);
        setProductName(p.name);
        setProductDescription(p.description || '');
        setProductPrice(p.price.toString());
        setProductModalVisible(true);
    };

    const validateProduct = () => {
        if (!productName.trim()) { Alert.alert('Eroare', 'Numele produsului este obligatoriu.'); return false; }
        const price = parseFloat(productPrice);
        if (!productPrice.trim() || isNaN(price) || price < 0) {
            Alert.alert('Eroare', 'Prețul trebuie să fie un număr valid pozitiv.'); return false;
        }
        return true;
    };

    const handleSaveProduct = async () => {
        if (!validateProduct()) return;
        setSavingProduct(true);
        try {
            const payload = {
                name: productName.trim(),
                description: productDescription.trim() || null,
                price: parseFloat(productPrice),
            };
            if (editingProduct) {
                const updated = await ProductService.updateProduct(editingProduct.id, payload);
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                Alert.alert('Succes', 'Produsul a fost actualizat!');
            } else {
                const created = await ProductService.createProduct(payload);
                setProducts(prev => [...prev, created]);
                Alert.alert('Succes', 'Produsul a fost adăugat!');
            }
            setProductModalVisible(false);
            resetProductForm();
        } catch (e: any) {
            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
        } finally {
            setSavingProduct(false);
        }
    };

    const handleDeleteProduct = () => {
        if (!editingProduct) return;
        Alert.alert('Șterge Produs', `Sigur dorești să ștergi "${editingProduct.name}"?`, [
            { text: 'Anulează', style: 'cancel' },
            {
                text: 'Șterge', style: 'destructive',
                onPress: async () => {
                    setSavingProduct(true);
                    try {
                        const result = await ProductService.deleteProduct(editingProduct.id);
                        if (result.success) {
                            setProducts(prev => prev.filter(p => p.id !== editingProduct.id));
                            setProductModalVisible(false);
                            resetProductForm();
                            Alert.alert('Succes', 'Produsul a fost șters!');
                        } else {
                            Alert.alert('Nu se poate șterge', result.error || 'Eroare la ștergere.');
                        }
                    } catch (e) {
                        Alert.alert('Eroare', 'Eroare de conexiune.');
                    } finally { setSavingProduct(false); }
                }
            }
        ]);
    };

    // ─── Subscription helpers ─────────────────────────────────────────────────
    const resetSubForm = () => {
        setSubName(''); setSubDescription(''); setSubType('ONE_TIME');
        setSubPrice(''); setSubVisits(''); setSubDuration('');
        setSubIsIndefinite(false); setEditingSub(null);
    };

    const openAddSub = () => { resetSubForm(); setSubModalVisible(true); };
    const openEditSub = (s: Subscription) => {
        setEditingSub(s);
        setSubName(s.name);
        setSubDescription(s.description || '');
        setSubType(s.type);
        setSubPrice(s.price.toString());
        setSubVisits(s.visitsPerMonth?.toString() || '');
        setSubDuration(s.durationMonths?.toString() || '');
        setSubIsIndefinite(s.isIndefinite ?? false);
        setSubModalVisible(true);
    };

    const validateSub = () => {
        if (!subName.trim()) { Alert.alert('Eroare', 'Numele abonamentului este obligatoriu.'); return false; }
        const price = parseFloat(subPrice);
        if (!subPrice.trim() || isNaN(price) || price < 0) {
            Alert.alert('Eroare', 'Prețul trebuie să fie un număr valid pozitiv.'); return false;
        }
        if (subType === 'RECURRING') {
            const visits = parseInt(subVisits);
            if (!subVisits.trim() || isNaN(visits) || visits < 1) {
                Alert.alert('Eroare', 'Numărul de vizite/lună este obligatoriu pentru abonamente recurente.'); return false;
            }
        }
        return true;
    };

    const handleSaveSub = async () => {
        if (!validateSub()) return;
        setSavingSub(true);
        try {
            const payload: CreateSubscriptionRequest = {
                name: subName.trim(),
                description: subDescription.trim() || null,
                type: subType,
                price: parseFloat(subPrice),
                visitsPerMonth: subType === 'RECURRING' ? parseInt(subVisits) : null,
                durationMonths: (subType === 'RECURRING' && !subIsIndefinite && subDuration.trim())
                    ? parseInt(subDuration)
                    : null,
                isIndefinite: subType === 'RECURRING' ? subIsIndefinite : null,
                isActive: true,
            };
            if (editingSub) {
                const updated = await SubscriptionService.updateSubscription(editingSub.id, payload);
                setSubscriptions(prev => prev.map(s => s.id === updated.id ? updated : s));
                Alert.alert('Succes', 'Abonamentul a fost actualizat!');
            } else {
                const created = await SubscriptionService.createSubscription(payload);
                setSubscriptions(prev => [...prev, created]);
                Alert.alert('Succes', 'Abonamentul a fost adăugat!');
            }
            setSubModalVisible(false);
            resetSubForm();
        } catch (e: any) {
            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
        } finally { setSavingSub(false); }
    };

    const handleDeactivateSub = () => {
        if (!editingSub) return;
        Alert.alert(
            editingSub.isActive ? 'Dezactivează Abonament' : 'Reactivează Abonament',
            editingSub.isActive
                ? `Abonamentul "${editingSub.name}" va fi dezactivat. Comenzile existente nu sunt afectate.`
                : `Abonamentul "${editingSub.name}" va fi reactivat.`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: editingSub.isActive ? 'Dezactivează' : 'Reactivează',
                    style: editingSub.isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        setSavingSub(true);
                        try {
                            if (editingSub.isActive) {
                                await SubscriptionService.deactivateSubscription(editingSub.id);
                                setSubscriptions(prev =>
                                    prev.map(s => s.id === editingSub.id ? { ...s, isActive: false } : s)
                                );
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
                                setSubscriptions(prev =>
                                    prev.map(s => s.id === updated.id ? updated : s)
                                );
                            }
                            setSubModalVisible(false);
                            resetSubForm();
                        } catch (e: any) {
                            Alert.alert('Eroare', e.message || 'Eroare de conexiune.');
                        } finally { setSavingSub(false); }
                    }
                }
            ]
        );
    };

    const formatPrice = (p: number) =>
        p.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' RON';

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Produse și Abonamente</Text>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <Pressable
                    style={[styles.tab, activeTab === 'products' && styles.tabActive]}
                    onPress={() => setActiveTab('products')}
                >
                    <MaterialIcons name="inventory" size={18} color={activeTab === 'products' ? '#FFF' : '#7A9BB5'} />
                    <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Produse</Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'subscriptions' && styles.tabActive]}
                    onPress={() => setActiveTab('subscriptions')}
                >
                    <MaterialCommunityIcons name="refresh-circle" size={18} color={activeTab === 'subscriptions' ? '#FFF' : '#7A9BB5'} />
                    <Text style={[styles.tabText, activeTab === 'subscriptions' && styles.tabTextActive]}>Abonamente</Text>
                </Pressable>
            </View>

            {/* ── PRODUCTS TAB ─────────────────────────────────────────────── */}
            {activeTab === 'products' && (
                <>
                    <View style={styles.actionContainer}>
                        <Pressable
                            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                            onPress={openAddProduct}
                        >
                            <AntDesign name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.addButtonText}>Adaugă Produs</Text>
                        </Pressable>
                        <Pressable style={styles.refreshButton} onPress={() => { setProductsLoading(true); fetchProducts(); }}>
                            <Ionicons name="refresh" size={22} color="#5D8AA8" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                        {productsLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#5D8AA8" />
                                <Text style={styles.loadingText}>Se încarcă produsele...</Text>
                            </View>
                        ) : products.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="inventory" size={60} color="#5D8AA8" />
                                <Text style={styles.emptyText}>Nu există produse încă</Text>
                            </View>
                        ) : (
                            products.map(product => (
                                <Pressable
                                    key={product.id}
                                    style={({ pressed }) => [styles.itemCard, pressed && styles.itemCardPressed]}
                                    onPress={() => openEditProduct(product)}
                                >
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{product.name}</Text>
                                        {product.description && (
                                            <Text style={styles.itemSubtext} numberOfLines={2}>{product.description}</Text>
                                        )}
                                    </View>
                                    <View style={styles.cardRight}>
                                        <View style={styles.greenPill}>
                                            <Text style={styles.greenPillText}>{formatPrice(product.price)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#666" style={{ marginLeft: 8 }} />
                                    </View>
                                </Pressable>
                            ))
                        )}
                    </ScrollView>

                    {/* Product Modal */}
                    <Modal animationType="slide" transparent visible={productModalVisible}
                        onRequestClose={() => { setProductModalVisible(false); resetProductForm(); }}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{editingProduct ? 'Editare Produs' : 'Produs Nou'}</Text>
                                    <Pressable onPress={() => { setProductModalVisible(false); resetProductForm(); }}>
                                        <AntDesign name="close" size={24} color="#666" />
                                    </Pressable>
                                </View>
                                <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Nume Produs *</Text>
                                        <TextInput style={styles.textInput} value={productName}
                                            onChangeText={setProductName} placeholder="Ex: Toaletă Ecologică Standard"
                                            placeholderTextColor="#999" />
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Descriere (opțional)</Text>
                                        <TextInput style={[styles.textInput, styles.textArea]} value={productDescription}
                                            onChangeText={setProductDescription} placeholder="Descriere detaliată..."
                                            placeholderTextColor="#999" multiline numberOfLines={4} textAlignVertical="top" />
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Preț (RON) *</Text>
                                        <TextInput style={styles.textInput} value={productPrice}
                                            onChangeText={setProductPrice} placeholder="Ex: 150"
                                            placeholderTextColor="#999" keyboardType="numeric" />
                                    </View>
                                </ScrollView>
                                <Pressable
                                    style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, savingProduct && styles.saveButtonDisabled]}
                                    onPress={handleSaveProduct} disabled={savingProduct}>
                                    {savingProduct
                                        ? <ActivityIndicator size="small" color="#FFF" />
                                        : <><Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.saveButtonText}>Salvează Produs</Text></>
                                    }
                                </Pressable>
                                {editingProduct && (
                                    <Pressable
                                        style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed, savingProduct && styles.saveButtonDisabled]}
                                        onPress={handleDeleteProduct} disabled={savingProduct}>
                                        <Ionicons name="trash-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.deleteButtonText}>Șterge Produs</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    </Modal>
                </>
            )}

            {/* ── SUBSCRIPTIONS TAB ────────────────────────────────────────── */}
            {activeTab === 'subscriptions' && (
                <>
                    <View style={styles.actionContainer}>
                        <Pressable
                            style={({ pressed }) => [styles.addButton, { backgroundColor: '#7B5EA7' }, pressed && { backgroundColor: '#5C3D8F' }]}
                            onPress={openAddSub}
                        >
                            <AntDesign name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.addButtonText}>Adaugă Abonament</Text>
                        </Pressable>
                        <Pressable style={styles.refreshButton} onPress={() => { setSubsLoading(true); fetchSubscriptions(); }}>
                            <Ionicons name="refresh" size={22} color="#5D8AA8" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                        {subsLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#7B5EA7" />
                                <Text style={styles.loadingText}>Se încarcă abonamentele...</Text>
                            </View>
                        ) : subscriptions.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="refresh-circle" size={60} color="#7B5EA7" />
                                <Text style={styles.emptyText}>Nu există abonamente încă</Text>
                            </View>
                        ) : (
                            subscriptions.map(sub => (
                                <Pressable
                                    key={sub.id}
                                    style={({ pressed }) => [
                                        styles.itemCard,
                                        !sub.isActive && styles.itemCardInactive,
                                        pressed && styles.itemCardPressed
                                    ]}
                                    onPress={() => openEditSub(sub)}
                                >
                                    <View style={styles.itemInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={styles.itemName}>{sub.name}</Text>
                                            <View style={[styles.typePill, sub.type === 'RECURRING' ? styles.typePillRecurring : styles.typePillOneTime]}>
                                                <Text style={styles.typePillText}>
                                                    {sub.type === 'RECURRING' ? 'Recurent' : 'O dată'}
                                                </Text>
                                            </View>
                                            {!sub.isActive && (
                                                <View style={styles.inactivePill}>
                                                    <Text style={styles.inactivePillText}>Inactiv</Text>
                                                </View>
                                            )}
                                        </View>
                                        {sub.description && (
                                            <Text style={styles.itemSubtext} numberOfLines={2}>{sub.description}</Text>
                                        )}
                                        {sub.type === 'RECURRING' && sub.visitsPerMonth != null && (
                                            <Text style={styles.itemSubtext}>
                                                {sub.visitsPerMonth} vizite/lună
                                                {sub.isIndefinite ? ' · Nedefinit' : sub.durationMonths ? ` · ${sub.durationMonths} luni` : ''}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.cardRight}>
                                        <View style={styles.purplePill}>
                                            <Text style={styles.purplePillText}>{formatPrice(sub.price)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#666" style={{ marginLeft: 8 }} />
                                    </View>
                                </Pressable>
                            ))
                        )}
                    </ScrollView>

                    {/* Subscription Modal */}
                    <Modal animationType="slide" transparent visible={subModalVisible}
                        onRequestClose={() => { setSubModalVisible(false); resetSubForm(); }}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{editingSub ? 'Editare Abonament' : 'Abonament Nou'}</Text>
                                    <Pressable onPress={() => { setSubModalVisible(false); resetSubForm(); }}>
                                        <AntDesign name="close" size={24} color="#666" />
                                    </Pressable>
                                </View>
                                <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Nume Abonament *</Text>
                                        <TextInput style={styles.textInput} value={subName}
                                            onChangeText={setSubName} placeholder="Ex: Igienizare Lunară"
                                            placeholderTextColor="#999" />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Descriere (opțional)</Text>
                                        <TextInput style={[styles.textInput, styles.textArea]} value={subDescription}
                                            onChangeText={setSubDescription} placeholder="Descriere..."
                                            placeholderTextColor="#999" multiline numberOfLines={3} textAlignVertical="top" />
                                    </View>

                                    {/* Type selector */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Tip Abonament *</Text>
                                        <View style={styles.typeSelector}>
                                            <Pressable
                                                style={[styles.typeOption, subType === 'ONE_TIME' && styles.typeOptionActive]}
                                                onPress={() => setSubType('ONE_TIME')}
                                            >
                                                <Ionicons name="flash" size={16} color={subType === 'ONE_TIME' ? '#FFF' : '#7B5EA7'} />
                                                <Text style={[styles.typeOptionText, subType === 'ONE_TIME' && styles.typeOptionTextActive]}>
                                                    O singură dată
                                                </Text>
                                            </Pressable>
                                            <Pressable
                                                style={[styles.typeOption, subType === 'RECURRING' && styles.typeOptionActive]}
                                                onPress={() => setSubType('RECURRING')}
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
                                        <TextInput style={styles.textInput} value={subPrice}
                                            onChangeText={setSubPrice} placeholder="Ex: 200"
                                            placeholderTextColor="#999" keyboardType="numeric" />
                                    </View>

                                    {/* Recurring-only fields */}
                                    {subType === 'RECURRING' && (
                                        <>
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.inputLabel}>Vizite / Lună *</Text>
                                                <TextInput style={styles.textInput} value={subVisits}
                                                    onChangeText={setSubVisits} placeholder="Ex: 2"
                                                    placeholderTextColor="#999" keyboardType="numeric" />
                                            </View>

                                            <View style={styles.inputGroup}>
                                                <View style={styles.switchRow}>
                                                    <Text style={styles.inputLabel}>Durată nedefinită</Text>
                                                    <Switch
                                                        value={subIsIndefinite}
                                                        onValueChange={setSubIsIndefinite}
                                                        trackColor={{ false: '#E0E0E0', true: '#7B5EA7' }}
                                                        thumbColor={subIsIndefinite ? '#FFF' : '#FFF'}
                                                    />
                                                </View>
                                                {!subIsIndefinite && (
                                                    <>
                                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Durata (luni)</Text>
                                                        <TextInput style={styles.textInput} value={subDuration}
                                                            onChangeText={setSubDuration} placeholder="Ex: 12 (lasă gol pentru nedefinit)"
                                                            placeholderTextColor="#999" keyboardType="numeric" />
                                                    </>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </ScrollView>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.saveButton, { backgroundColor: '#7B5EA7' },
                                        pressed && { backgroundColor: '#5C3D8F' },
                                        savingSub && styles.saveButtonDisabled
                                    ]}
                                    onPress={handleSaveSub} disabled={savingSub}>
                                    {savingSub
                                        ? <ActivityIndicator size="small" color="#FFF" />
                                        : <><Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.saveButtonText}>Salvează Abonament</Text></>
                                    }
                                </Pressable>

                                {editingSub && (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.deleteButton,
                                            { backgroundColor: editingSub.isActive ? '#E53935' : '#4CAF50' },
                                            pressed && { opacity: 0.85 },
                                            savingSub && styles.saveButtonDisabled
                                        ]}
                                        onPress={handleDeactivateSub} disabled={savingSub}>
                                        <Ionicons
                                            name={editingSub.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                                            size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.deleteButtonText}>
                                            {editingSub.isActive ? 'Dezactivează' : 'Reactivează'}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    </Modal>
                </>
            )}
        </View>
    );
};

export default ProductsAndSubscriptions;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#16283C' },
    headerContainer: {
        marginTop: 60, paddingHorizontal: 20, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center',
    },
    backButton: { marginRight: 15 },
    headerText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },

    // Tab bar
    tabBar: {
        flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
        backgroundColor: '#1E3448', borderRadius: 12, padding: 4,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: 10, gap: 6,
    },
    tabActive: { backgroundColor: '#5D8AA8' },
    tabText: { color: '#7A9BB5', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    // Action row
    actionContainer: {
        flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, alignItems: 'center',
    },
    addButton: {
        flex: 1, flexDirection: 'row', backgroundColor: '#4CAF50',
        paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', elevation: 3,
    },
    addButtonPressed: { opacity: 0.85 },
    addButtonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    refreshButton: {
        marginLeft: 12, width: 48, height: 48,
        backgroundColor: 'rgba(93,138,168,0.2)', borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },

    // Lists
    scrollContainer: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    loadingText: { color: '#999', marginTop: 15, fontSize: 14 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 20 },

    // Cards
    itemCard: {
        flexDirection: 'row', backgroundColor: '#2A3E55', borderRadius: 12,
        padding: 16, marginBottom: 12, alignItems: 'center',
    },
    itemCardInactive: { opacity: 0.55 },
    itemCardPressed: { backgroundColor: '#354D67' },
    itemInfo: { flex: 1, marginRight: 10 },
    itemName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    itemSubtext: { color: '#AAA', fontSize: 13, marginTop: 4 },
    cardRight: { flexDirection: 'row', alignItems: 'center' },

    // Pills
    greenPill: {
        backgroundColor: 'rgba(76,175,80,0.2)', paddingHorizontal: 12,
        paddingVertical: 6, borderRadius: 8,
    },
    greenPillText: { color: '#4CAF50', fontSize: 13, fontWeight: 'bold' },
    purplePill: {
        backgroundColor: 'rgba(123,94,167,0.2)', paddingHorizontal: 12,
        paddingVertical: 6, borderRadius: 8,
    },
    purplePillText: { color: '#B39DDB', fontSize: 13, fontWeight: 'bold' },
    typePill: {
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    typePillRecurring: { backgroundColor: 'rgba(123,94,167,0.25)' },
    typePillOneTime: { backgroundColor: 'rgba(93,138,168,0.25)' },
    typePillText: { color: '#CCC', fontSize: 11, fontWeight: '600' },
    inactivePill: {
        backgroundColor: 'rgba(229,57,53,0.2)', paddingHorizontal: 8,
        paddingVertical: 3, borderRadius: 6,
    },
    inactivePillText: { color: '#EF9A9A', fontSize: 11, fontWeight: '600' },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 20, paddingBottom: 30, maxHeight: '88%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 16,
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#16283C' },
    formContainer: { paddingHorizontal: 20 },
    inputGroup: { marginBottom: 18 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#16283C', marginBottom: 8 },
    textInput: {
        backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15,
        paddingVertical: 12, fontSize: 15, color: '#16283C',
        borderWidth: 1, borderColor: '#E0E0E0',
    },
    textArea: { height: 90, textAlignVertical: 'top' },

    // Type selector
    typeSelector: { flexDirection: 'row', gap: 10 },
    typeOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 10,
        borderWidth: 2, borderColor: '#7B5EA7', backgroundColor: '#FFF',
    },
    typeOptionActive: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
    typeOptionText: { color: '#7B5EA7', fontWeight: '600', fontSize: 14 },
    typeOptionTextActive: { color: '#FFF' },

    // Switch row
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    // Buttons
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
