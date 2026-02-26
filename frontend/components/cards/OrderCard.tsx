import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../types/OrderTypes';
import { getDateInfo, getClientName, getActionText, getLocationText } from '../../utils/orderUtils';
import DateBadge from '../display/DateBadge';
import { AppColors } from '../../constants/Colors';

interface OrderCardProps {
    order: Order;
    hasTask: boolean;
    onPress: (order: Order) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, hasTask, onPress }) => {
    const dateInfo = getDateInfo(order);

    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => onPress(order)}
        >
            <View style={styles.cardInfo}>
                <View style={styles.clientRow}>
                    <Text style={styles.clientName}>{getClientName(order)}</Text>
                </View>
                <Text style={styles.actionText}>{getActionText(order)}</Text>

                <View style={styles.addressContainer}>
                    <Ionicons name="location-sharp" size={14} color={AppColors.screenBackground} style={{ marginRight: 4 }} />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {getLocationText(order)}
                    </Text>
                </View>

                <View style={[styles.statusIndicator, hasTask ? styles.statusAssigned : styles.statusPending]}>
                    <Text style={styles.statusText}>
                        {hasTask ? 'Rută atribuită' : 'Neatribuită'}
                    </Text>
                </View>
            </View>

            <DateBadge dateInfo={dateInfo} />
        </Pressable>
    );
};

export default OrderCard;

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#5D8AA8',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardInfo: {
        flex: 1,
        paddingRight: 10,
    },
    clientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    clientName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
        marginRight: 8,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: AppColors.textWhite,
        marginBottom: 8,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressText: {
        fontSize: 12,
        color: '#E0E0E0',
        flex: 1,
    },
    statusIndicator: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    statusAssigned: {
        backgroundColor: 'rgba(46, 204, 113, 0.3)',
    },
    statusPending: {
        backgroundColor: 'rgba(241, 196, 15, 0.3)',
    },
    statusText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: AppColors.textWhite,
    },
});
