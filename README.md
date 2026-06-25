# SpartansAttend

Attendance + season-management app for the pathak — QR/code check-in, attendance
history, parikshan scores, events, costume rosters, and admin tools. Built with
**Expo (SDK 54) + React Native** and **Firebase** (Auth + Firestore).

> Uses a **development build** (not Expo Go) because of native modules
> (`expo-dev-client`, `react-native-vector-icons`, notifications, secure-store).

---

## Prerequisites

- **Node.js 20+**
- **Bun** (package manager — this repo uses `bun.lock`) → https://bun.sh
- **Git**, and **Watchman** (`brew install watchman`) recommended on macOS
- **For iOS** (macOS only): **Xcode** + Command Line Tools, and **CocoaPods**
  (`brew install cocoapods`). Includes the iOS Simulator.
- **For Android:** **Android Studio** with the SDK, platform-tools, and at least
  one **AVD (emulator)**. Make sure `adb` is on your `PATH`.

You do **not** need the EAS CLI or any Expo/Apple/Google account to develop
locally — production builds & releases are handled by the project owner.

---

## Setup

```bash
# 1. Clone
git clone https://github.com/gitgibsgau/spartansattend.git
cd spartansattend

# 2. Install dependencies
bun install

# 3. Create the .env file (get the values from the project owner)
#    These are required — the app won't build without them.
```

Create a file named **`.env`** in the repo root:

```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

> `.env` is gitignored and never committed.

> **Use the DEV Firebase project, not production.** Point `.env` at a dev/staging
> project so your local testing never touches live member data (see below).

---

## Dev backend (Firebase) & seed data

For local development, point `.env` at the **shared dev Firebase project** (never
prod). Ask the owner for its 6 config values, put them in `.env` — that's it.
The shared project is already seeded, so you can skip straight to running the app.

<details>
<summary>Optional: spin up your own isolated dev project instead</summary>

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Authentication → Email/Password → Enable.**
3. **Firestore Database → Create database** (Database ID `(default)`, any region).
4. Project settings → **Your apps → Web (`</>`)** → copy the config into `.env`.
5. Seed it (below) and deploy `firestore.rules`.
</details>

### Seed sample data

> Only needed for your **own** dev project — the shared project is already
> seeded by the owner. A fresh project is empty (no season, sessions, or
> accounts), so seed it:

```bash
# 1. Dev project → Firestore → Rules → temporarily open, then Publish:
#       allow read, write: if true;
# 2. With .env pointing at your dev project:
node scripts/seed-dev.js
# 3. Paste the real firestore.rules back into the dev project and Publish.
```

This creates login-ready accounts (password **`devpass123`**):

| Email | Role |
|---|---|
| `admin@dev.test` | admin |
| `student@dev.test` | student — has a group, costume sizes, attendance |
| `costume@dev.test` | costume-roster admin |
| `donation@dev.test` | donation-roster admin |

…plus roster-only students, a season config, sessions, and sample attendance.

> `seed-dev.js` refuses to run against the production project — never run it on prod.

### Security rules

The Firestore rules are in [`firestore.rules`](firestore.rules). Deploy them to
your dev project (Firebase Console → Firestore → Rules → paste → Publish) so you
test against the real access model. **Production rules are deployed by the owner.**

---

## Run on a simulator / emulator

These commands compile the development build, install it, and start Metro. The
**first run is slow** (native build + pods); after that it's fast.

```bash
# iOS (macOS + Xcode)
bun run ios

# Android (with an emulator running, or Android Studio open)
bun run android
```

Day-to-day after the dev build is installed:

```bash
bun start        # start Metro, then press i (iOS) or a (Android)
# press r to reload, or shake / Cmd+D for the dev menu
```

- **JS/UI changes** hot-reload instantly.
- **Native changes** (new native dependency, app config) require re-running
  `bun run ios` / `bun run android`.

---

## Troubleshooting

- **"No development build installed" / app won't open** — run `bun run ios` or
  `bun run android` to (re)install the dev build. `bun start` alone only starts
  Metro; it doesn't install the app.
- **Erased the simulator** — the dev build is gone; re-run `bun run ios`.
- **Stale bundle / weird errors** — `bunx expo start -c` clears Metro's cache.
- **iOS build fails on pods** — `cd ios && pod install` (or delete `ios/` and let
  `bun run ios` regenerate it via prebuild).

---

## Project notes

- **Secrets:** never commit `.env`. The Firebase web config is low-sensitivity
  (it ships in the app and is guarded by Firestore rules), but keep it private.
- **Security rules** live in [`firestore.rules`](firestore.rules) and are
  deployed by the owner via the Firebase Console. Keep this file in sync if you
  change access rules.
- **Owner-only (not needed for local dev):** `eas.json`, EAS builds
  (`eas build`), OTA updates (`eas update`), and store submissions are handled by
  the project owner.

---

## Tech stack

Expo SDK 54 · React Native (New Architecture) · Firebase Auth & Firestore ·
React Navigation · `expo-dev-client` · `react-native-dotenv`.
