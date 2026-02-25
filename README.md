# Dami Prod EcoTrack

**Dami Prod EcoTrack** is a comprehensive management application designed to streamline the operations of a portable toilet rental service. It connects sales, technical planning, and drivers to ensure efficient delivery, maintenance, and removal of units.

---

## Project Purpose

The core objective is to provide visibility and control over the entire lifecycle of portable toilet management for a fleet of approximately 15 drivers. The system addresses the following key workflows:

1. **Sales & Ordering**: Sales representatives input orders, specifying the type of toilet, required date, and delivery location.
2. **Technical Planning**: The technical department receives orders and organises them into optimised routes and daily schedules for drivers.
3. **Driver Operations**: Drivers receive their daily routes and tasks (delivery, cleaning, or removal).
   - **Photo Evidence**: Upon completing a task, drivers take photos which are uploaded to DigitalOcean Spaces under `poze cabine/{taskId}_{clientName}/`.
   - **Location-aware**: The app supports GPS coordinates for tasks.

---

## Tech Stack

### Frontend (Mobile App)
- **Framework**: React Native with [Expo](https://expo.dev/) (SDK 54)
- **Language**: TypeScript
- **Navigation**: Expo Router 6
- **Build System**: EAS (Expo Application Services)
- **Maps**: React Native Maps (Google Maps)
- **Styling**: Native StyleSheet

### Backend (API)
- **Framework**: Spring Boot 3.5.7
- **Language**: Java 21
- **Database**: PostgreSQL (Production), H2 (Dev/Testing)
- **ORM**: Spring Data JPA
- **Build Tool**: Gradle
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **Deployment**: DigitalOcean Droplet

---

## Running the Development Server

### Prerequisites
- Node.js (v18+)
- Android Studio with an Android emulator (Pixel 9 recommended)
- The **development build APK** installed on the device/emulator (see EAS section below — you must install the dev build once before using Metro)
- Backend running locally or pointing to the production server

### 1. Configure the API URL

Open `frontend/constants/ApiConfig.ts` and set the correct URL:

```ts
// For local development (backend running on your machine):
export const API_BASE_URL = 'http://10.0.2.2:8080/api'; // Android emulator → host machine
// OR your LAN IP:
export const API_BASE_URL = 'http://192.168.x.x:8080/api';

// For production:
export const API_BASE_URL = 'http://146.190.224.202:8080/api';
```

> ⚠️ **Android emulator gotcha**: `localhost` inside the emulator does NOT refer to your PC.
> Use `10.0.2.2` to reach your machine's localhost from the emulator.
> If using a physical device, use your PC's LAN IP instead.

### 2. Start the Backend

```bash
cd backend
./gradlew bootRun
```

> ℹ️ The backend uses H2 in-memory database by default (dev profile). For production PostgreSQL,
> ensure the `.env` file is configured with correct DB credentials and `spaces.*` keys.

### 3. Start the Metro Bundler

```bash
cd frontend
npx expo start --dev-client
```

> Use `--clear` if you suspect a corrupted Metro cache (e.g. after pulling major changes):
> ```bash
> npx expo start --dev-client --clear
> ```

### 4. Open on Android

After Metro starts:
- Press **`a`** in the terminal to open the app on the connected Android emulator/device.
- Or scan the QR code from the Expo Dev Client app on a physical device.

> ⚠️ **White screen after Metro restart**: If you see a white screen after restarting Metro,
> the emulator's app instance has lost connection. Fix:
> - Press **`a`** in the terminal (forces a fresh open), or
> - Go to recent apps on the emulator → swipe away the app → reopen from launcher.
> - If neither works: Device Manager → three dots next to your AVD → **Cold Boot Now**.

> ⚠️ **Persistent white screen (GPU glitch)**: If the white screen only goes away when you press
> the emulator's power button (lock/unlock), this is an emulator GPU rendering bug.
> Fix permanently: Device Manager → Edit AVD → Show Advanced Settings →
> Graphics: change from "Automatic" to **"Software - GLES 2.0"** → Cold Boot.

---

## EAS Build (Android APK)

EAS (Expo Application Services) builds the APK in the cloud. You need an Expo account.

### Build Profiles (defined in `eas.json`)

| Profile | Purpose | Output |
|---------|---------|--------|
| `development` | Dev client APK — installs on device for use with Metro | `.apk` (debug) |
| `preview` | Internal testing APK — standalone, no Metro needed | `.apk` |
| `production` | Play Store release | `.aab` (App Bundle) |

### One-time Setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account (andreidan)
eas login
```

### Building the Development Client (first-time or after native changes)

You must rebuild the dev client APK whenever you:
- Add a new native dependency (e.g. `expo-camera`, `react-native-maps`)
- Change `app.config.js` (permissions, package name, plugins)
- Upgrade Expo SDK

```bash
cd frontend
eas build --profile development --platform android
```

After build completes, download the `.apk` from the EAS dashboard and install it on your emulator:
```bash
# Drag and drop the APK onto the emulator, or:
adb install path/to/downloaded.apk
```

> ⚠️ **EAS login issues**: If `eas build` fails with auth errors, run `eas logout` then `eas login` again.
> Make sure the `owner` field in `app.config.js` matches your Expo username (`andreidan`).

> ⚠️ **`google-services.json` missing**: EAS build requires `frontend/google-services.json`
> (Firebase config for Google Maps on Android). This file is gitignored — you must add it manually
> before building. Get it from the Firebase console for the `com.damiprod.ecotrack` project.

> ⚠️ **Google Maps API key**: The key is read from `.env` via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
> For EAS cloud builds, add this as an EAS secret:
> ```bash
> eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value YOUR_KEY_HERE
> ```
> Otherwise the map will render as a blank grey screen.

### Building a Preview APK (for testers, no Metro needed)

```bash
eas build --profile preview --platform android
```

Share the download link from the EAS dashboard directly with testers. They can install it like any APK.

> ⚠️ **`usesCleartextTraffic`**: The preview/production builds must be able to reach the backend.
> If the backend runs over plain HTTP (not HTTPS), `usesCleartextTraffic: true` must be set
> in `app.config.js` under `android` AND in the `expo-build-properties` plugin — both are already
> configured. If you ever switch to HTTPS, remove these flags.

> ⚠️ **API URL in non-dev builds**: Preview and production builds use whatever URL is hardcoded
> in `constants/ApiConfig.ts` at build time. Make sure it points to the production server
> (`146.190.224.202`) before building preview/production, not your local IP.

### Building for Production (Play Store)

```bash
eas build --profile production --platform android
```

This outputs an `.aab` bundle for Google Play. Submit with:
```bash
eas submit --platform android
```

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `frontend/.env` | Google Maps API key |
| `spaces.access-key` | `backend/.env` | DigitalOcean Spaces access key |
| `spaces.secret-key` | `backend/.env` | DigitalOcean Spaces secret key |
| `spaces.bucket` | `backend/.env` | DO Spaces bucket name |
| `spaces.region` | `backend/.env` | DO Spaces region (e.g. `fra1`) |
| `spring.datasource.url` | `backend/.env` | PostgreSQL connection URL (production) |

> ⚠️ Neither `.env` file is committed to git. If setting up a fresh environment, ask a team member
> for the values or check the DigitalOcean / Firebase consoles.

---

## Project Structure

```
Dami Prod EcoTrack/
├── frontend/                  # React Native / Expo app
│   ├── app/                   # Expo Router screens
│   │   ├── Driver/            # Driver-facing screens
│   │   ├── Sales/             # Sales-facing screens
│   │   └── Technical/         # Technical team screens
│   ├── services/              # API service layer (fetch wrappers)
│   ├── constants/             # ApiConfig.ts (base URL)
│   ├── app.config.js          # Expo app config
│   └── eas.json               # EAS build profiles
└── backend/                   # Spring Boot API
    └── src/main/java/com/example/damiProd/
        ├── controller/        # REST controllers
        ├── domain/            # JPA entities
        ├── repository/        # Spring Data repositories
        └── service/           # Business logic
```
