import React from 'react';
import { StyleSheet, View } from 'react-native';
import DetailRow from '../display/DetailRow';
import { Order, isAmplasare, isRidicari, isIgienizari } from '../../types/OrderTypes';
import { getLocationText } from '../../utils/orderUtils';
import { AppColors } from '../../constants/Colors';

interface OrderInfoCardProps {
    order: Order;
}

/** Formats a date-range or single date for display. */
const renderDateRow = (label: string, dateStr?: string, endDateStr?: string) => {
    if (!dateStr) return null;
    try {
        const start = new Date(dateStr);
        if (isNaN(start.getTime())) return null;
        const fmt = (d: Date) => d.toLocaleDateString('ro-RO');
        if (endDateStr) {
            const end = new Date(endDateStr);
            if (!isNaN(end.getTime()) && start.getTime() !== end.getTime()) {
                return <DetailRow label={label} value={`${fmt(start)} - ${fmt(end)}`} />;
            }
        }
        return <DetailRow label={label} value={fmt(start)} />;
    } catch {
        return null;
    }
};

/** Renders the order-type-specific rows (product, quantity, dates, etc.). */
const renderOrderTypeRows = (order: Order) => {
    if (isAmplasare(order)) {
        return (
            <>
                <DetailRow label="Produs" value={order.product?.name} />
                <DetailRow label="Cantitate" value={order.quantity?.toString()} />
                {renderDateRow('Perioadă / Data', order.startDate, order.endDate)}
                {(order.durationDays || order.isIndefinite) && (
                    <DetailRow
                        label="Durată"
                        value={order.durationDays ? `${order.durationDays} zile` : 'Nedefinit'}
                    />
                )}
                {order.igienizariPerMonth != null && (
                    <DetailRow label="Igienizări/lună" value={order.igienizariPerMonth} />
                )}
            </>
        );
    }

    if (isRidicari(order)) {
        return (
            <>
                <DetailRow label="Produs" value={order.pickupProductName} />
                <DetailRow label="Cantitate" value={order.pickupQuantity?.toString()} />
                {renderDateRow('Data Ridicării', order.pickupDate)}
            </>
        );
    }

    if (isIgienizari(order)) {
        return (
            <>
                <DetailRow label="Abonament" value={order.subscription?.name} />
                <DetailRow
                    label="Tip"
                    value={order.subscription?.type === 'ONE_TIME' ? 'O singură dată' : 'Recurent'}
                />
                {order.subscription?.price != null && (
                    <DetailRow label="Preț" value={`${order.subscription.price} RON`} />
                )}
                {order.subscription?.visitsPerMonth != null && (
                    <DetailRow label="Vizite/lună" value={order.subscription.visitsPerMonth} />
                )}
                {renderDateRow('Data Igienizării', order.sanitationDate)}
            </>
        );
    }

    return null;
};

const OrderInfoCard: React.FC<OrderInfoCardProps> = ({ order }) => {
    const clientName =
        order.client?.type === 'company'
            ? order.client?.name || order.client?.email || 'N/A'
            : order.client?.fullName || order.client?.email || 'N/A';
    const clientAddress = getLocationText(order);

    return (
        <View style={styles.card}>
            <DetailRow label="Nume Client" value={clientName} />
            <DetailRow
                label="Tip Client"
                value={order.client?.type === 'company' ? 'Firmă' : 'Persoană Fizică'}
            />
            {order.client?.cui && <DetailRow label="CUI" value={order.client.cui} />}
            <DetailRow label="Adresă" value={clientAddress} isMultiline />

            <View style={styles.spacer} />
            {renderOrderTypeRows(order)}

            <View style={styles.spacer} />
            <DetailRow label="Tip Comandă" value={order.orderType} />
            <DetailRow label="Contact" value={order.contact} />
            <DetailRow label="Detalii" value={order.details} isMultiline />
        </View>
    );
};

export default OrderInfoCard;

const styles = StyleSheet.create({
    card: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginBottom: 30,
    },
    spacer: {
        height: 10,
    },
});
