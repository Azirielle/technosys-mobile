# TechnoSys Mobile Portal 📱

A professional React Native Expo field operations client designed for field service dispatches, anti-manipulation geofenced attendance logs, ticketing service chat, and offline stock management.

---

## 🚀 Key Features

### 1. Anti-Manipulation DTR System (Time-In / Time-Out)
* **Geofence Matching:** Technicians can only clock in or out if they are located within the boundary radius of an active authorized office branch.
* **GPS Integrity Auditing:** Checks device signals for `is_mocked` flags (detects fake GPS spoofing applications) and verifies accuracy variance (rejects logs if GPS signal is worse than 50 meters).
* **Automatic Shift Calculator:** Computes shift durations locally on clock-out and writes them to the DB as decimal hours (e.g. 8.25 hrs) for direct payroll computation.

### 2. Offline-First Synchronization Engine (FIFO Queue)
* **Transaction Buffer:** Intercepts network/Supabase request timeouts and caches clock-ins, clock-outs, and spare parts checkouts locally using `AsyncStorage`.
* **Chronological Background Sync:** A background loop runs every 15 seconds to flush queued updates sequentially to the remote database once network connectivity is restored.
* **Offline Status Banner:** Displays a distinct status banner at the top of the interface notifying the technician of pending synchronization items.

### 3. Service Ticket Dispatch & Spare Parts Checkout
* **Support Desk:** Interactive list of assigned HR and operations service requests.
* **Parts Drawer:** Smooth slide-up animations (`LayoutAnimation`) to select spare parts, review physical stock levels, and check out items.
* **Automated Logging:** Parts checked out are logged to the stock ledger and write automated timeline entries in the ticket discussion thread (supports offline local overrides).

### 4. Earnings & Profile Settings
* Real-time published payslip viewer (SSS, PhilHealth, Pag-IBIG, and Net take-home earnings).
* Premium opening splash transition with parallel springs, tagline fades, and activity loaders masking session validation.

---

## 🛠️ Developer Setup & Launch Guide

### 1. Prerequisites
Ensure you have the following installed:
* **Node.js** (v18.x or later)
* **npm** (v9.x or later)
* **Expo Go** application on your physical iOS/Android device (to test on mobile).

### 2. Clone the Repository
```bash
git clone https://github.com/Azirielle/technosys-mobile.git
cd technosys-mobile
```

### 3. Environment Config
The client uses Supabase to sync data. Create a local environment variables configuration. Since Expo uses TypeScript imports, the credentials are loaded from `src/lib/supabase.ts`. Ensure your settings match your active Supabase URL and Anon key.

### 4. Install Dependencies
```bash
npm install
```

### 5. Launch the Client
To boot up the Metro Bundler:
```bash
npx expo start
```

* **Web View (Simulator):** Press **`w`** to run in web mode.
* **Android Emulator:** Press **`a`** (requires Android Studio).
* **iOS Simulator:** Press **`i`** (requires Xcode on macOS).
* **Physical Device:** Scan the QR code in the terminal using your phone camera (iOS) or the Expo Go application (Android).

---

## 🧪 Validation & Type-safety
The codebase enforces strict type safety. Run compile checks prior to committing:
```bash
npx tsc --noEmit
```
