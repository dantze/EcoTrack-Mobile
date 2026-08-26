module.exports = {
    expo: {
        name: "EcoTrack",
        slug: "frontend",
        version: "1.2.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "frontend",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        // --- EAS Update (OTA) ---
        // `eas update` ships JS/asset changes straight to installed apps
        // without a store review. It CANNOT ship native changes — adding a
        // native module still needs a new build.
        runtimeVersion: {
            policy: "appVersion"
        },
        updates: {
            url: "https://u.expo.dev/b68f1933-d3e1-4cdb-a5e3-31a0540679b2",
            fallbackToCacheTimeout: 0
        },
        splash: {
            image: "./assets/images/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#16283C"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.damiprod.ecotrack"
        },
        android: {
            package: "com.damiprod.ecotrack",
            versionCode: 4,
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            config: {
                googleMaps: {
                    apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
                }
            },
            googleServicesFile: "./google-services.json",
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
            usesCleartextTraffic: true
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: [
            "expo-router",
            ["expo-build-properties", {
                android: {
                    usesCleartextTraffic: true
                }
            }]
        ],
        extra: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            eas: {
                projectId: "b68f1933-d3e1-4cdb-a5e3-31a0540679b2"
            }
        },
        owner: "andreidan",
        experiments: {
            typedRoutes: true
        }
    }
};
