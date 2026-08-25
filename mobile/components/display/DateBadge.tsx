import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateInfo } from '../../utils/orderUtils';
import { AppColors } from '../../constants/Colors';

interface DateBadgeProps {
    dateInfo: DateInfo;
}

const DateBadge: React.FC<DateBadgeProps> = ({ dateInfo }) => {
    return (
        <View style={[styles.dateBadge, dateInfo.isRange && styles.dateBadgeRange]}>
            {dateInfo.isRange ? (
                <View style={styles.rangeContainer}>
                    <View style={styles.dateColumn}>
                        <Text style={styles.rangeMonth}>{dateInfo.start.m}</Text>
                        <Text style={styles.rangeDay}>{dateInfo.start.d}</Text>
                    </View>
                    <Text style={styles.rangeSeparator}>-</Text>
                    <View style={styles.dateColumn}>
                        <Text style={styles.rangeMonth}>{dateInfo.end.m}</Text>
                        <Text style={styles.rangeDay}>{dateInfo.end.d}</Text>
                    </View>
                </View>
            ) : (
                <>
                    <Text style={styles.dateMonth}>{dateInfo.m}</Text>
                    <Text style={styles.dateDay}>{dateInfo.d}</Text>
                </>
            )}
        </View>
    );
};

export default DateBadge;

const styles = StyleSheet.create({
    dateBadge: {
        backgroundColor: AppColors.screenBackground,
        borderRadius: 12,
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateBadgeRange: {
        width: 100,
        paddingHorizontal: 5,
    },
    rangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    dateColumn: {
        alignItems: 'center',
    },
    rangeMonth: {
        color: AppColors.textWhite,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    rangeDay: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
    },
    rangeSeparator: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 12,
    },
    dateMonth: {
        color: AppColors.textWhite,
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateDay: {
        color: AppColors.textWhite,
        fontSize: 20,
        fontWeight: 'bold',
    },
});
