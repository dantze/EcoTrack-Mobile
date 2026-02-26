import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import listStyles from './listStyles';

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
