import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/layout/MenuScreen';
import MenuButton from '../../components/layout/MenuButton';

const Menu = () => {
    const router = useRouter();

    const menuItems = [
        { label: 'Creare Client', onPress: () => router.push({ pathname: '/Sales/CreateClient' }) },
        { label: 'Creare Comanda', onPress: () => router.push({ pathname: '/Sales/CreateOrder' }) },
        { label: 'Comenzi', onPress: () => router.push({ pathname: '/Technical/Orders' }) },
        { label: 'Rute', onPress: () => router.push({ pathname: '/Technical/Routes' }) },
        { label: 'Rute și Șoferi', onPress: () => router.push({ pathname: '/Technical/RoutesAndDrivers' }) },
        { label: 'Schimbare Șoferi și Rute', onPress: () => router.push({ pathname: '/Technical/ChangeDriver' }) },
    ];

    return (
        <MenuScreen
            title="Meniu Tehnic"
            items={menuItems}

            onLogout={() => router.replace('/login')}
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;