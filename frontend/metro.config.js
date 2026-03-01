const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// On web, resolve react-native-maps to a lightweight shim
// that exports empty components. This prevents bundler errors
// caused by native-only imports in react-native-maps.
// Actual web map functionality is provided by .web.tsx file variants.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-maps') {
        return {
            filePath: path.resolve(__dirname, 'web-shims/react-native-maps.js'),
            type: 'sourceFile',
        };
    }

    // Fall back to the default resolver
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
