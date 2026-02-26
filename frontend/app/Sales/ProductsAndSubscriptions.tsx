import {
    StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator,
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProductService, Product } from '../../services/ProductService';
import { Subscription, SubscriptionService, SubscriptionType } from '../../services/SubscriptionService';
import { formatPrice } from '../../utils/formatters';
import ActionBar from '../../components/ActionBar';
import ProductModal from '../../modals/ProductModal';
import SubscriptionModal from '../../modals/SubscriptionModal';
import ScreenHeader from '../../components/ScreenHeader';
import { AppColors } from '../../constants/Colors';

// ─── Tab type ────────────────────────────────────────────────────────────────
type ActiveTab = 'products' | 'subscriptions';

const ProductsAndSubscriptions = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ActiveTab>('products');

    // ─── Products state ──────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [productPrice, setProductPrice] = useState('');

    // ─── Subscriptions state ─────────────────────────────────────────────────
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [subsLoading, setSubsLoading] = useState(true);
    const [subModalVisible, setSubModalVisible] = useState(false);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);
    const [subName, setSubName] = useState('');
    const [subDescription, setSubDescription] = useState('');
    const [subType, setSubType] = useState<SubscriptionType>('ONE_TIME');
    const [subPrice, setSubPrice] = useState('');
    const [subVisits, setSubVisits] = useState('');
    const [subDuration, setSubDuration] = useState('');
    const [subIsIndefinite, setSubIsIndefinite] = useState(false);

    // ─── Fetch ───────────────────────────────────────────────────────────────
    const fetchProducts = useCallback(async () => {
        try { setProducts(await ProductService.getAllProducts()); }
        catch (e) { console.error('Error fetching products:', e); }
        finally { setProductsLoading(false); }
    }, []);

    const fetchSubscriptions = useCallback(async () => {
        try { setSubscriptions(await SubscriptionService.getAllSubscriptions()); }
        catch (e) { console.error('Error fetching subscriptions:', e); }
        finally { setSubsLoading(false); }
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

    // ─── Product open / reset ────────────────────────────────────────────────
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

    // ─── Subscription open / reset ───────────────────────────────────────────
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

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <ScreenHeader title="Produse și Abonamente" />

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
                    <ActionBar
                        label="Adaugă Produs"
                        color="#4CAF50" pressedColor="#388E3C"
                        onAdd={openAddProduct}
                        onRefresh={() => { setProductsLoading(true); fetchProducts(); }}
                    />

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

                    <ProductModal
                        visible={productModalVisible}
                        editingProduct={editingProduct}
                        productName={productName}
                        productDescription={productDescription}
                        productPrice={productPrice}
                        onChangeProductName={setProductName}
                        onChangeProductDescription={setProductDescription}
                        onChangeProductPrice={setProductPrice}
                        onClose={() => { setProductModalVisible(false); resetProductForm(); }}
                        onSaved={(product) => {
                            if (editingProduct) {
                                setProducts(prev => prev.map(p => p.id === product.id ? product : p));
                            } else {
                                setProducts(prev => [...prev, product]);
                            }
                        }}
                        onDeleted={(id) => setProducts(prev => prev.filter(p => p.id !== id))}
                    />
                </>
            )}

            {/* ── SUBSCRIPTIONS TAB ────────────────────────────────────────── */}
            {activeTab === 'subscriptions' && (
                <>
                    <ActionBar
                        label="Adaugă Abonament"
                        color="#7B5EA7" pressedColor="#5C3D8F"
                        onAdd={openAddSub}
                        onRefresh={() => { setSubsLoading(true); fetchSubscriptions(); }}
                    />

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
                                        pressed && styles.itemCardPressed,
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

                    <SubscriptionModal
                        visible={subModalVisible}
                        editingSub={editingSub}
                        subName={subName}
                        subDescription={subDescription}
                        subType={subType}
                        subPrice={subPrice}
                        subVisits={subVisits}
                        subDuration={subDuration}
                        subIsIndefinite={subIsIndefinite}
                        onChangeSubName={setSubName}
                        onChangeSubDescription={setSubDescription}
                        onChangeSubType={setSubType}
                        onChangeSubPrice={setSubPrice}
                        onChangeSubVisits={setSubVisits}
                        onChangeSubDuration={setSubDuration}
                        onChangeSubIsIndefinite={setSubIsIndefinite}
                        onClose={() => { setSubModalVisible(false); resetSubForm(); }}
                        onSaved={(sub) => {
                            if (editingSub) {
                                setSubscriptions(prev => prev.map(s => s.id === sub.id ? sub : s));
                            } else {
                                setSubscriptions(prev => [...prev, sub]);
                            }
                        }}
                        onToggleActive={(sub) => {
                            setSubscriptions(prev => prev.map(s => s.id === sub.id ? sub : s));
                        }}
                    />
                </>
            )}
        </View>
    );
};

export default ProductsAndSubscriptions;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: AppColors.screenBackground },

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
});
