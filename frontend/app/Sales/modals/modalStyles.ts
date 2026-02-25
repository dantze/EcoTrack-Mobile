import { StyleSheet } from 'react-native';

/**
 * Shared styles used by both ProductModal and SubscriptionModal.
 */
const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 20, paddingBottom: 30, maxHeight: '88%',
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 16,
    },
    title: { fontSize: 22, fontWeight: 'bold', color: '#16283C' },
    formContainer: { paddingHorizontal: 20 },
    inputGroup: { marginBottom: 18 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#16283C', marginBottom: 8 },
    textInput: {
        backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15,
        paddingVertical: 12, fontSize: 15, color: '#16283C',
        borderWidth: 1, borderColor: '#E0E0E0',
    },
    textArea: { height: 90, textAlignVertical: 'top' },
    saveButton: {
        flexDirection: 'row', paddingVertical: 15,
        marginHorizontal: 20, borderRadius: 12, alignItems: 'center',
        justifyContent: 'center', marginTop: 10,
    },
    saveButtonPressed: { opacity: 0.85 },
    saveButtonDisabled: { backgroundColor: '#BDC3C7' },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    deleteButton: {
        flexDirection: 'row', paddingVertical: 12,
        marginHorizontal: 20, borderRadius: 12, alignItems: 'center',
        justifyContent: 'center', marginTop: 10,
    },
    deleteButtonPressed: { opacity: 0.85 },
    deleteButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    // Type selector (subscriptions)
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
});

export default modalStyles;
