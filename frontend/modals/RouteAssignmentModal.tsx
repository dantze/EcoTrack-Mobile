import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    Pressable,
    ScrollView,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Route } from '../services/RouteService';
import { getDayOfWeekLabel } from '../constants/RouteConstants';

interface RouteAssignmentModalProps {
    visible: boolean;
    onClose: () => void;
    routes: Route[];
    selectedRoute: Route | null;
    onSelectRoute: (route: Route) => void;
    onFinalize: () => void;
    assigning: boolean;
}

const RouteAssignmentModal: React.FC<RouteAssignmentModalProps> = ({
    visible,
    onClose,
    routes,
    selectedRoute,
    onSelectRoute,
    onFinalize,
    assigning,
}) => (
    <Modal
        animationType="slide"
        transparent
        visible={visible}
        onRequestClose={onClose}
    >
        <View style={styles.overlay}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Selectează Ruta</Text>
                    <Pressable onPress={onClose}>
                        <Ionicons name="close" size={24} color="#16283C" />
                    </Pressable>
                </View>

                {/* Finalize Button */}
                <Pressable
                    style={[
                        styles.finalizeButton,
                        (!selectedRoute || assigning) && styles.disabledButton,
                    ]}
                    onPress={onFinalize}
                    disabled={!selectedRoute || assigning}
                >
                    {assigning ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <>
                            <Text style={styles.finalizeText}>Finalizează Atribuirea</Text>
                            <MaterialCommunityIcons
                                name="truck-delivery"
                                size={20}
                                color="white"
                                style={{ marginLeft: 8 }}
                            />
                        </>
                    )}
                </Pressable>

                {/* Routes List */}
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {routes.length > 0 ? (
                        routes.map((route) => {
                            const isSelected = selectedRoute?.id === route.id;
                            return (
                                <Pressable
                                    key={route.id}
                                    style={[styles.routeCard, isSelected && styles.activeCard]}
                                    onPress={() => onSelectRoute(route)}
                                >
                                    <View style={styles.routeInfo}>
                                        <Text style={[styles.driverName, isSelected && styles.activeText]}>
                                            {route.employeeName || 'Șofer neasignat'}
                                        </Text>
                                        <Text style={[styles.routeName, isSelected && styles.activeSubtext]}>
                                            {route.name || `Ruta #${route.id}`}
                                            {route.dayOfWeek ? ` • ${getDayOfWeekLabel(route.dayOfWeek)}` : ''}
                                        </Text>
                                        <Text style={[styles.taskCount, isSelected && styles.activeSubtext]}>
                                            {route.tasks?.length || 0} sarcini
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={24} color="white" />
                                    )}
                                </Pressable>
                            );
                        })
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="alert-circle-outline" size={40} color="#999" />
                            <Text style={styles.emptyText}>Nu există rute disponibile</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </View>
    </Modal>
);

export default RouteAssignmentModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(22, 40, 60, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 20,
        alignItems: 'center',
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#16283C',
    },
    finalizeButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#5D8AA8',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        marginBottom: 20,
    },
    disabledButton: {
        backgroundColor: '#BDC3C7',
    },
    finalizeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    list: {
        maxHeight: 300,
        width: '100%',
    },
    listContent: {
        paddingBottom: 10,
    },
    routeCard: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activeCard: {
        backgroundColor: '#5D8AA8',
        borderColor: '#16283C',
    },
    routeInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#16283C',
        marginBottom: 4,
    },
    routeName: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    taskCount: {
        fontSize: 12,
        color: '#888',
    },
    activeText: {
        color: 'white',
    },
    activeSubtext: {
        color: 'rgba(255,255,255,0.8)',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
        marginTop: 10,
    },
});
