# SwipeSort 📸

**Declutter your photo gallery with a swipe.** An offline-first, open-source mobile app built with **React Native, Expo and TypeScript**.

SwipeSort helps you review photos, keep your favorites in custom categories, and review unwanted photos before deleting them from your phone. No account, ads or subscription.

> **Version:** 1.4.0 · **Tested:** on a Samsung Android phone · **iOS:** source is cross-platform, but not yet validated on an iPhone.

## Features

- **Swipe left** to add a photo to an in-app review bin; delete from the device **only after a separate confirmation**.
- **Swipe right** to keep a photo and assign it to a category.
- **Custom categories**: add, rename, or remove empty categories; view and reclassify saved photos.
- **Selected sources**: choose which device albums can be scanned; existing `SwipeSort - ...` albums are excluded from sorting.
- **Surprise mode**: optional randomized ordering to rediscover older photos.
- **Batch album synchronization**: organize kept photos into Samsung/Android albums on request. Android may still require OS permission confirmations.
- **Pinch to zoom** temporarily (up to 3×), then return to normal on release. Two-finger gestures cannot trigger a swipe decision.
- **Undo, local progress and dark-purple UI**, with no backend.

> ⚠️ **Be careful with real photo libraries.** Back up important photos. Test deletion and album synchronization on disposable copies first. The app modifies originals only on user-confirmed actions.

## Stack

| Layer | Technology |
| --- | --- |
| App | React Native + Expo |
| Language | TypeScript |
| Media access | `expo-media-library/legacy` |
| Local preferences & decisions | `@react-native-async-storage/async-storage` |
| Gestures | React Native `PanResponder` + touch distance calculations |
| Android installation | EAS Build (APK) |

## Getting started

You will need **Node.js** and **npm**.

```bash
npm install
npm run test:logic
npm run test:layout
npm run test:pinch
```

To develop the UI:

```bash
npx expo start
```

**Important:** On Android, Expo Go does not grant the full photo-library access this app needs. Use an Android development build or a standalone APK for complete photo sorting.

### Build an Android APK

1. Install EAS CLI: `npm install -g eas-cli`.
2. Sign in: `eas login`.
3. Link **your own** Expo project: `eas init` (or follow the EAS setup prompts).
4. Run: `eas build -p android --profile preview`.
5. Install the resulting APK from the Expo build page.

**Windows PowerShell tip:** If execution of `npm.ps1` or `eas.ps1` is blocked, use `npm.cmd` and `eas.cmd` instead.

`BUILD-V1.4.cmd` is a helper intended for **upgrading an already configured local SwipeSort installation**. It expects an existing EAS project link and increments the Android build number. For a fresh clone, use the commands above instead.

### Updating an existing Android installation

Keep the same Android package identifier, EAS signing key, and an incremented `android.versionCode`. Install the newer APK **over** the old app. **Do not uninstall first:** that would erase locally stored sorting decisions and categories.

## Privacy

SwipeSort has **no custom server, analytics, tracking SDK, login, or image upload code**. Photos are read and managed on the user's device, and the photo sorting decisions are stored locally. A cloud connection is used by **Expo EAS to build the application source**, not to process the user's gallery photos. See [PRIVACY.md](PRIVACY.md).

## Project structure

```text
App.tsx                 # Screens, navigation and swipe UX
src/media.ts            # Photo library operations and album sync
src/logic.ts            # Sorting decisions and category logic
src/model.ts            # Types, defaults and storage keys
src/pinch.ts            # Pinch-to-zoom calculations
src/swipe-layout.ts     # Photo sizing and date utilities
tests/                  # Logic, layout and zoom tests
assets/                 # Application icon assets
```

## Roadmap

- [x] Swipe to keep / delete, with undo and review bin
- [x] Personalized categories and batch album sync
- [x] Source selection and optional random mode
- [x] Full-screen layout and temporary pinch zoom
- [ ] Broader Android device testing
- [ ] iOS testing and distribution
- [ ] Optional photo-library insights and duplicate detection

## License

MIT — see [LICENSE](LICENSE).

---

### Français — démarrage rapide

Le code est libre et gratuit. Pour utiliser la **photothèque complète d'un Android**, installe une APK générée via EAS (Expo Go seul ne suffit pas). Les photos restent sur le téléphone ; les classements sont enregistrés localement. **Sauvegarde tes photos avant un premier test de suppression ou de déplacement.**
