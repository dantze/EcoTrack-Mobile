import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/layout/MenuScreen';
import { AuthService } from '../../services/AuthService';
import MenuButton from '../../components/layout/MenuButton';

const Menu = () => {
    const router = useRouter();

    // Revoke server-side before leaving. Navigating away on its own left this
    // device's refresh token valid for another 60 days — and now that the way
    // back in is an access request an admin must approve, a "logout" that only
    // changed screens would also leave a live session behind the new one.
    const handleLogout = async () => {
        await AuthService.logout();
        router.replace('/enrollment');
    };

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

            onLogout={() => void handleLogout()}
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;