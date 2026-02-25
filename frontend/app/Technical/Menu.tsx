import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/MenuScreen';
import MenuButton from '../../components/MenuButton';

const Menu = () => {
    const router = useRouter();

    const menuItems = [
        { label: 'Comenzi', onPress: () => router.push({ pathname: '/Technical/Orders' }) },
        { label: 'Rute', onPress: () => router.push({ pathname: '/Technical/Routes' }) },
        { label: 'Rute și Șoferi', onPress: () => router.push({ pathname: '/Technical/RoutesAndDrivers' }) },
        { label: 'Schimbare Șoferi și Rute', onPress: () => router.push({ pathname: '/Technical/ChangeDriver' }) },
    ];

    return (
        <MenuScreen
            title="Meniu Tehnic"
            items={menuItems}
            showMap
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;