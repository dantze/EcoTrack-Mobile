// Web shim for react-native-maps
// This module is resolved on web platform only (via metro.config.js)
// It provides empty/dummy exports to prevent bundler errors.
// Actual web map functionality is provided by .web.tsx files.

import React from 'react';
import { View } from 'react-native';

const MapView = React.forwardRef((props, ref) => {
    const { children, style, ...rest } = props;
    return (
        <View ref={ref} style={style}>
            {children}
        </View>
    );
});

MapView.displayName = 'MapView';

const Marker = (_props) => null;

const PROVIDER_GOOGLE = 'google';

export default MapView;
export { Marker, PROVIDER_GOOGLE };
