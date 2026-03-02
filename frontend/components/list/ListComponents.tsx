import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

// ─── EmptyState ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
    icon: React.ComponentProps<typeof Feather>['name'];
    message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message }) => (
    <View style={listStyles.emptyContainer}>
        <Feather name={icon} size={60} color="#8BA8BE" />
        <Text style={listStyles.emptyText}>{message}</Text>
    </View>
);

// ─── InfoRow ─────────────────────────────────────────────────────────────────
interface InfoRowProps {
    icon: React.ComponentProps<typeof Feather>['name'];
    text: string;
    numberOfLines?: number;
}

export const InfoRow: React.FC<InfoRowProps> = ({ icon, text, numberOfLines }) => (
    <View style={listStyles.infoRow}>
        <Feather name={icon} size={14} color="#8BA8BE" />
        <Text style={listStyles.infoText} numberOfLines={numberOfLines}>{text}</Text>
    </View>
);

// ─── TypeBadge ───────────────────────────────────────────────────────────────
interface TypeBadgeProps {
    label: string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ label }) => (
    <View style={listStyles.typeBadge}>
        <Text style={listStyles.typeBadgeText}>{label}</Text>
    </View>
);

// ─── OrderStatusBadge ────────────────────────────────────────────────────────
interface OrderStatusBadgeProps {
    label: string;
    color: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ label, color }) => (
    <View style={[listStyles.orderStatusBadge, { backgroundColor: color }]}>
        <View style={[listStyles.orderStatusDot, { backgroundColor: '#FFFFFF' }]} />
        <Text style={listStyles.orderStatusBadgeText}>{label}</Text>
    </View>
);

// ─── ListCard ────────────────────────────────────────────────────────────────
interface ListCardProps {
    onPress: () => void;
    onDelete: () => void;
    children: React.ReactNode;
}


export const ListCard: React.FC<ListCardProps> = ({ onPress, onDelete, children }) => (
    <View style={listStyles.card}>
        <Pressable
            style={({ pressed }) => [
                listStyles.cardContent,
                pressed && listStyles.cardPressed,
            ]}
            onPress={onPress}
        >
            {children}

            <View style={listStyles.editHint}>
                <Feather name="edit-2" size={12} color="#5A8DAB" />
                <Text style={listStyles.editHintText}>Apasă pentru editare</Text>
            </View>
        </Pressable>

        <Pressable
            style={({ pressed }) => [
                listStyles.deleteButton,
                pressed && listStyles.deleteButtonPressed,
            ]}
            onPress={onDelete}
        >
            <AntDesign name="delete" size={22} color="#FF6B6B" />
        </Pressable>
    </View>

    
);

export const listStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    centered: {
        flex: 1,
        backgroundColor: '#16283C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        color: '#8BA8BE',
        fontSize: 18,
    },
    // Card
    card: {
        backgroundColor: '#1E3A50',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
    },
    cardPressed: {
        opacity: 0.7,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 8,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    // Badge
    typeBadge: {
        backgroundColor: '#427992',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    typeBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    // Order status badge
    orderStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
        gap: 5,
    },
    orderStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    orderStatusBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    // Info row
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    infoText: {
        color: '#B0C4D4',
        fontSize: 14,
    },
    // Delete button
    deleteButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 107, 107, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    deleteButtonPressed: {
        opacity: 0.6,
    },
    // Edit hint
    editHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    editHintText: {
        color: '#5A8DAB',
        fontSize: 12,
    },
});
