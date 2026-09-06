# Evergrow on AYN Thor

The local Android app bundles the game into an offline APK. A hardware-accelerated WebView runs the existing TypeScript game; a Kotlin shell supplies native controller input, full-screen landscape display, audio/lifecycle handling, and a second-display Presentation. It does not connect to Sites or require the development server.

Both Android windows request a matching-resolution 60 Hz display mode. The main game and title portrait also cap presentation at 60 FPS if the OS keeps a higher refresh rate. Skipped display callbacks preserve elapsed time, so combat continues to run its fixed 120 Hz simulation. Browser rendering and system-wide refresh/performance settings are unchanged. On the connected Thor, Android confirmed the main panel switched to 60 Hz; the lower panel remained physically at 120 Hz despite registering the companion’s 60 Hz request. The companion still receives state at 4 Hz and map images at 2 Hz; it does not run a second game simulation.

## Two screens, one character

The upper screen runs the game. Its minimap (including crypts), short Journey list and town portal form one navigation group, with shared visibility and hit regions. Keep this group visible on Thor even when a companion Presentation exists: the firmware dashboard can cover that window while Android reports it as presented, powered on and visible. The native presence check is suitable for transport availability only, not proof the user can see navigation. No reliable dashboard-occlusion signal was found in the normal app APIs; automatic upper-HUD hiding has been removed. Compact phone layouts still use their dedicated touch navigation.

The lower screen uses the Astral UI palette, shared procedural item art, Pixelify lettering, and Barlow numerals:

- **Map:** explored terrain and crypt rooms, the player marker, local zoom, Journey tracking, and access to the full map/journal.
- **Pack:** a scrollable six-column pack with 64 cells beside two-column worn equipment. Slots use the lower display’s available width instead of shrinking to fit its height. Tap an item to inspect its shared tooltip and comparison; Equip uses the normal character command. Back or controller B closes inspection. Browsing, inspection and equipping do not pause or resume combat. Pause manually when desired.
- **Build:** power, effective attributes, combat/resource stats, XP, and unspent-point badges. Attributes and Skill atlas open their existing upper-screen panels.
- **Portal:** requests the existing town portal action, with the same restrictions and cancellation rules.

The lower screen is a projection, not a second simulation or save writer. Primary state is published four times per second, with fog-respecting terrain images twice per second. Item recipes are sent instead of large repeated SVG strings; the companion renders/caches the shared icons locally. Transfers are bounded to 400,000 string characters, and native forwarding retains only one in-flight frame and the newest pending frame. If a map image exceeds the packet budget, the previous map remains while character information continues updating.

Native forwarding includes companion tab changes, so hidden-map rendering suppression also works in the APK.

Every command carries the active character ID. Stale sessions, busy save-backed actions, title/death phases and invalid items are rejected. Equip resolves the item ID to its current bag position and reuses validated character commands; Journey tracking uses its durable command. Inspection survives live gameplay and manual pause changes; death or character changes clear it. Controller B/native Back closes inspection first, without also dodging or resuming. Explicit links to upper-screen panels keep those panels’ normal lifecycle.

Thor's own system dashboard can cover the companion. Dismiss that dashboard to see the app's lower display. Ordinary Android devices without a presentation display still run the upper-screen game.

## Controls and saves

Native `KeyEvent` / joystick `MotionEvent` input is normalized into the same standard snapshot consumed by `GamepadInput`. Existing dead zones, action mappings, neutral rearm, inventory/menu navigation and disconnect pause apply. See [controls](controls.md). On the title screen, D-pad/left stick highlights characters and A loads the highlighted save directly; A on an empty slot focuses creation. Character names use the Android keyboard. The upper character window now shows an LB/RB section rail and gives Equipment, Inventory and Stats their own full-width handheld view. The atlas has Tree / Node / Skills sections, a pinned skill bar, A for node actions, X to reach assignment, and right-stick inspector scrolling. Its compact effect summary and assignment remain near the top; no touchscreen is needed to assign skills.

The app uses the same worker/IndexedDB save system at a stable bundled HTTPS asset origin. APK updates installed over the existing package preserve app data. **Android, Safari, localhost and the hosted game currently have separate local characters.** Cloud synchronization is available only in the Site-enabled web build; the Android wrapper remains local-only with no cloud tabs or network requests. Uninstalling or clearing Android app data removes its saves; there is no browser-save migration in this packaging checkpoint.

Backgrounding clears input, pauses play, requests a save and mutes audio. Regular autosaves remain enabled. Android process termination can still lose changes since the last completed checkpoint. Assets are served through `WebViewAssetLoader`; external navigation/network resources and file access are blocked. WebView debugging is enabled only in debug builds.

Both WebViews disable Android’s default whole-view focus foreground, and the shared UI disables the browser tap tint. Game-owned focus outlines and pressed states remain visible. This prevents controller focus from washing out the entire screen.

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

Code tests cover invalid bridge input, native snapshot rearm, stale/busy/dead command rejection, pause/close/equip ownership, moved-item resolution, zoom bounds and full-bag transfer size. Frame-pacing tests cover 60/90/120/144 Hz callbacks, timestamp jitter, preserved simulation time and suspension recovery. Native build/install and both display surfaces were checked on the connected Thor. Gameplay feel, physical controller acceptance and sustained performance remain user-tested.

## Aim assistance and rendering checkpoint — September 6

Touch/controller direction now selects nearby visible enemies in a forward cone, including directional skills. The real resolved weapon/skill reach bounds assistance; ground/self skills remain manually placed. Existing mouse assistance, enemy projectiles and collision rules are unchanged.

A read-only 10-second CPU profile on the connected Thor identified repeated native HUD frame drawing and lower-map PNG encoding (about 271 ms of self time for PNG encoding in that sample). Static Astral metalwork is now cached at native display density with four bounded entries per drawing context; animated glass, energy, glints and text remain live. The companion reports its active tab via session-checked commands, so hidden maps and maps covered by item inspection no longer redraw/encode. Visible maps retain 2 Hz updates; telemetry remains 4 Hz. Frame CPU measurements now include the companion work. These remove specific costs; sustained FPS and combat feel still need player acceptance.

Routine local autosaves now run every 20 seconds; important actions retain their immediate checkpoint. Android never contacts the save server.
