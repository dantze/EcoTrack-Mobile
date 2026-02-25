import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { AppColors } from '../constants/Colors';

const mapImageSource = require('../assets/images/harta_romania.png');

interface MenuItem {
    label: string;
    onPress: () => void;
}

interface MenuScreenProps {
    title: string;
    items: MenuItem[];
    showMap?: boolean;
    renderButton: (item: MenuItem, index: number) => React.ReactNode;
}

const MenuScreen: React.FC<MenuScreenProps> = ({ title, items, showMap = false, renderButton }) => {
    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{title}</Text>
            </View>

            <View style={styles.buttonsContainer}>
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {renderButton(item, index)}
                        {index < items.length - 1 && <View style={styles.separator} />}
                    </React.Fragment>
                ))}
            </View>

            {showMap && (
                <View style={styles.mapContainer}>
                    <Image
                        source={mapImageSource}
                        style={styles.mapImage}
                        resizeMode="contain"
                    />
                </View>
            )}
        </View>
    );
};

export default MenuScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
    },
    headerText: {
        color: AppColors.textWhite,
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    buttonsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingBottom: 50,
        marginTop: 0,
    },
    separator: {
        width: 100,
        height: 2,
        backgroundColor: AppColors.separatorColor,
        marginVertical: 15,
    },
    mapContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
        zIndex: 1,
    },
    mapImage: {
        width: '90%',
        height: 250,
        opacity: 0.8,
    },
});
