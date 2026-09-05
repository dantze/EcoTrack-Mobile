// Does THIS build need Android's cleartext-HTTP exemption? (TODO-85)
//
// Android 9+ refuses plaintext HTTP unless an app opts in, and this app opted in
// app-wide because the backend was a droplet on `http://146.190.224.202:8080`.
// Cloud Run is HTTPS-only, so a production build has no cleartext destination
// left and the exemption buys nothing except the ability for a misconfiguration
// — or a hostile network offering a plain-HTTP redirect — to be silently
// accepted rather than refused by the platform.
//
// It cannot simply be deleted: the documented local loop is `docker compose`
// on `http://localhost:8080`, and a developer on a physical device points at a
// LAN address, also plain HTTP. So the permission follows the need — it is on
// exactly when the backend this build was configured with is itself http://.
// A production build sets EXPO_PUBLIC_API_BASE_URL to an https:// URL (and
// deploy-mobile.yml refuses to ship without it), so production gets `false`
// with nobody having to remember anything.
//
// The narrower alternative — a network_security_config.xml permitting cleartext
// to localhost and 10.0.2.2 only — was rejected: it needs a custom config
// plugin, and it would break the LAN-address case that physical-device
// debugging actually uses.
//
// This mirrors the resolution in constants/ApiConfig.ts on purpose; both read
// the same variable, and the fallback there is http://localhost:8080/api.
const backendUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8080/api";
const usesCleartextTraffic = backendUrl.startsWith("http://");

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
            googleServicesFile: "./google-services.json",
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
            // Computed above (TODO-85): on only for an http:// backend.
            usesCleartextTraffic
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
                    // The same computed value, so the two cannot disagree —
                    // this one writes the manifest attribute, the field above
                    // is Expo's own. They were two hardcoded `true`s.
                    usesCleartextTraffic
                }
            }]
        ],
        extra: {
            // EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is gone with the Sales section
            // that needed it (TODO-33): no screen here renders a map or looks
            // up an address any more.
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
