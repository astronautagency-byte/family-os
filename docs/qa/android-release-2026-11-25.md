# Android internal-test candidate — November 25, 2026

## Candidate and build evidence

- Package `app.famos.desktop`, version name 1.0.0, version code 2026112501.
- Signed ARM64 App Bundle: `../../store-release/FamOS-Android-2026112501.aab` from the release checkout. Verification JSON alongside it contains SHA-256.
- Tauri release build completed successfully after correcting the new generated Kotlin signing configuration. Existing Rust/Kotlin/deprecation warnings remain; no required build error remains.
- Java jarsigner verified the bundle signature. ZIP integrity passed. The one packaged native library has 16,384-byte ELF LOAD alignment. This static verification is not a 16 KB device test.
- Merged release manifest verified package/version, target SDK 36, runtime microphone/camera/location declarations, no background-location permission, cleartext disabled and app-data backup disabled.
- Latest calendar, restored Plan & billing and helper pause are included. Public realtime preview remains disabled for this Android candidate; Android voice capability is not device-verified.

## Reproduce without embedding signing credentials

Initialize with `tauri android init --ci` using Java 17 and the installed Android SDK. Run `npm run mobile:android:prepare:release` after every regeneration to apply private signing references, optional permission declarations and FamOS icons. Private `~/.config/famos/android-signing.properties` supplies storeFile, storePassword, keyAlias and keyPassword; override its path using FAMOS_ANDROID_KEYSTORE_PROPERTIES. The key/properties files are excluded from Git; the local key is owner-readable only. Existing signing certificate preserved. No secure-backup verification is asserted.

Build with Java 17, ANDROID_HOME pointing to the SDK, VITE_MIA_REALTIME=false, and `npx tauri android build --target aarch64 --aab --ci`. The existing Android-only Rust build flags configure 16 KB alignment; Gradle plugin 8.11 handles current bundle packaging.

The idempotent preparation/missing-credentials test passed. Actual Gradle compilation and merged manifest/signature/ELF checks provide separate integration evidence. No emulator or physical Android device was connected, so sign-in, recording/permission prompts, calendar controls, task deletion, app deletion and store screenshots remain NOT RUN on Android.

## Play Console gate

The organization account offers Create app and no longer blocks on account verification. No FamOS app record exists yet. Prepared name “FamOS – Family Organizer”, English, Free, existing package. Operator review of new policy/signing/export declarations is pending. No declarations were accepted, app record created, release uploaded or public publication claimed during this step.

Once created: upload to internal testing; verify signing/package and install; exercise main/account-deletion flows on Android; capture actual Android screenshots; complete app access, Data safety, target audience, rating, privacy/deletion URLs and country availability from verified data flows. Paid purchases remain unavailable. Existing compliance/legal-review gaps are not closed by Google developer verification.

References used: [Tauri signing](https://v2.tauri.app/distribute/sign/android/), [Android 16 KB support](https://developer.android.com/guide/practices/page-sizes).
