# Evergrow on AYN Thor

The local Android app bundles the game into an offline APK. A hardware-accelerated WebView runs the existing TypeScript game; a Kotlin shell supplies native controller input, full-screen landscape display, audio/lifecycle handling, and a second-display Presentation. It does not connect to Sites or require the development server.

## Two screens, one character

The upper screen runs the game. The lower screen uses the Astral UI palette, shared procedural item art, Pixelify lettering, and Barlow numerals:

- **Map:** explored terrain and crypt rooms, the player marker, local zoom, Journey tracking, and access to the full map/journal.
- **Pack:** all 64 bag cells beside compact worn equipment. Tap an item to inspect its shared tooltip and comparison; Equip uses the normal character command. Back or controller B closes inspection. Inspection pauses combat; Resume returns to play.
- **Build:** power, effective attributes, combat/resource stats, XP, and unspent-point badges. Attributes and Skill atlas open their existing upper-screen panels.
- **Portal:** requests the existing town portal action, with the same restrictions and cancellation rules.

The lower screen is a projection, not a second simulation or save writer. Primary state is published four times per second, with fog-respecting terrain images twice per second. Item recipes are sent instead of large repeated SVG strings; the companion renders/caches the shared icons locally. Transfers are bounded to 400,000 string characters, and native forwarding retains only one in-flight frame and the newest pending frame. If a map image exceeds the packet budget, the previous map remains while character information continues updating.

Every command carries the active character ID. Stale sessions, busy save-backed actions, title/death phases and invalid items are rejected. Equip resolves the item ID to its current bag position and reuses validated character commands; Journey tracking uses its durable command. Main-screen Resume and controller Back cannot leave an orphaned item detail on the lower screen.

Thor's own system dashboard can cover the companion. Dismiss that dashboard to see the app's lower display. Ordinary Android devices without a presentation display still run the upper-screen game.

## Controls and saves

Native `KeyEvent` / joystick `MotionEvent` input is normalized into the same standard snapshot consumed by `GamepadInput`. Existing dead zones, action mappings, neutral rearm, inventory/menu navigation and disconnect pause apply. See [controls](controls.md). Character names use the Android keyboard.

The app uses the same worker/IndexedDB save system at a stable bundled HTTPS asset origin. APK updates installed over the existing package preserve app data. **Android, Safari, localhost and the hosted game currently have separate local characters.** Cloud synchronization is not implemented. Uninstalling or clearing Android app data removes its saves; there is no browser-save migration in this packaging checkpoint.

Backgrounding clears input, pauses play, requests a save and mutes audio. Regular autosaves remain enabled. Android process termination can still lose changes since the last completed checkpoint. Assets are served through `WebViewAssetLoader`; external navigation/network resources and file access are blocked. WebView debugging is enabled only in debug builds.

The Thor tested here ships WebView 109. Shared item surfaces include opaque CSS fallbacks when `color-mix` is unsupported, including the upper inventory and vendor tooltips.

## Build and install

Requirements: Node supported by Vite, Java 17, Android SDK platform/build-tools 35, and USB debugging enabled on the device. `android/local.properties` should contain your local `sdk.dir`, or set `ANDROID_HOME`. SDK paths and generated assets are ignored by Git.

```sh
npm run setup
npm run android:build
# With one USB device connected:
npm run android:install
# Or select a device explicitly:
ANDROID_SERIAL=your-device-id npm run android:install
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. The script builds both Vite entrypoints, stages assets, assembles the debug APK, and optionally installs/launches it. Package ID: `com.dimillian.evergrow`. Keep the signing key stable for future APK updates. This is a local debug distribution, not a Play Store release.

## Owners and verification

- `android/.../MainActivity.kt`: asset loading, Android lifecycle, audio focus and bounded display bridge.
- `android/.../ControllerInput.kt`: physical inputs and short-tap retention.
- `thor-native.ts`, `thor-runtime.ts`: browser/native boundary and primary projection scheduling.
- `thor-commands.ts`, `thor-protocol.ts`: validated commands, session/phase ownership and standard controller parsing.
- `thor-state.ts`, `thor-screen.ts` / `.css`: state projection and compact lower-screen UI.
- `/thor.html?preview`: save-free static interface fixture for the in-app browser. It never creates a gameplay simulation or accesses character storage.

Code tests cover invalid bridge input, native snapshot rearm, stale/busy/dead command rejection, pause/close/equip ownership, moved-item resolution, zoom bounds and full-bag transfer size. Native build/install and both display surfaces were checked on the connected Thor. Gameplay feel, physical controller acceptance and sustained performance remain user-tested.
