import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/MenuScreen';
import MenuButton from '../../components/MenuButton';

const Menu = () => {
    const router = useRouter();

    const menuItems = [
        { label: 'Selectează Șofer', onPress: () => router.push({ pathname: '/Driver/DriverSelection' }) },
        { label: 'Rutele Mele', onPress: () => router.push({ pathname: '/Driver/DriverRoutes' }) },
    ];

    return (
        <MenuScreen
            title="Meniu Șofer"
            items={menuItems}
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;
