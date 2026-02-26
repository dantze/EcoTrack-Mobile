import { StyleSheet } from 'react-native';

const listStyles = StyleSheet.create({
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

export default listStyles;
