# Android internal-test candidate — November 25, 2026

## Candidate and build evidence

- Package `app.famos.desktop`, version name 1.0.0, version code 1.
- Signed ARM64 App Bundle: `/Users/alexvorobiev/Project Vibe/FamOS/store-release/FamOS-Android-1.aab` from the release checkout. Verification JSON alongside it contains SHA-256.
- Tauri release build completed successfully after correcting the new generated Kotlin signing configuration. Existing Rust/Kotlin/deprecation warnings remain; no required build error remains.
- Java jarsigner verified the bundle signature. ZIP integrity passed. The one packaged native library has 16,384-byte ELF LOAD alignment. This static verification is not a 16 KB device test.
- Merged release manifest verified package/version, target SDK 36, runtime microphone/camera/location declarations, no background-location permission, optional autofocus/GPS/network hardware declarations, cleartext disabled and app-data backup disabled.
- Latest calendar, restored Plan & billing and helper pause are included. Public realtime preview remains disabled for this Android candidate; Android voice capability is not device-verified.

## Reproduce without embedding signing credentials

Initialize with `tauri android init --ci` using Java 17 and the installed Android SDK. Run `npm run mobile:android:prepare:release` after every regeneration to apply private signing references, optional permission declarations and FamOS icons. Private `~/.config/famos/android-signing.properties` supplies storeFile, storePassword, keyAlias and keyPassword; override its path using FAMOS_ANDROID_KEYSTORE_PROPERTIES. The key/properties files are excluded from Git; the local key is owner-readable only. Existing signing certificate preserved. No secure-backup verification is asserted.

Build with Java 17, ANDROID_HOME pointing to the SDK, VITE_MIA_REALTIME=false, and `npx tauri android build --target aarch64 --aab --ci`. The existing Android-only Rust build flags configure 16 KB alignment; Gradle plugin 8.11 handles current bundle packaging.

The idempotent preparation/missing-credentials test passed. Actual Gradle compilation and merged manifest/signature/ELF checks provide separate integration evidence. No emulator or physical Android device was connected, so sign-in, recording/permission prompts, calendar controls, task deletion, app deletion and store screenshots remain NOT RUN on Android.

## Play Console gate

The operator completed new app creation declarations. FamOS – Family Organizer now exists as Play app 4972585474654758784. An internal release is being configured with owner-only QA access. The initial date-based bundle code 2026112501 was uploaded but removed from the draft after Google flagged its excessive size. The replacement uses version code 1. No high-code release was rolled out. Subsequent builds must increment this integer rather than restoring the date scheme. Public production publication is not claimed.

Once created: upload to internal testing; verify signing/package and install; exercise main/account-deletion flows on Android; capture actual Android screenshots; complete app access, Data safety, target audience, rating, privacy/deletion URLs and country availability from verified data flows. Paid purchases remain unavailable. Existing compliance/legal-review gaps are not closed by Google developer verification.

References used: [Tauri signing](https://v2.tauri.app/distribute/sign/android/), [Android 16 KB support](https://developer.android.com/guide/practices/page-sizes).

## Verified Google Play outcome

Build 1 (1.0.0) is **Available to internal testers**, track **Active**, on November 25. The owner-only FamOS Owner QA list is selected and saved (one account). Install/opt-in URL: https://play.google.com/apps/internaltest/4701727226919974512 . The package temporarily appears as `app.famos.desktop (unreviewed)` until store setup and review are completed. This is internal distribution, not public production approval.

Google accepted the matching native symbol ZIP alongside the existing ReTrace mapping. The final preview showed Ready to release with no remaining errors/warnings. Function-symbol tables are supplied; full DWARF source/line debugging and an actual crash-symbolication test are not claimed. The high date-based version was never rolled out; corrected build code 1 was signed/ELF-validated again before uploading. Optional camera/autofocus and location/GPS/network declarations now survive regeneration. Increment the integer for later uploads.

Durable proof: `/Users/alexvorobiev/Project Vibe/FamOS/store-release/FamOS-Android-1-internal-active.jpg`; verification JSON and native symbol ZIP are beside the AAB. Main Android device flows and screenshots remain NOT RUN. Store listing, Data safety, audience/rating, app-access review and public-production submission are still outstanding.

## Store setup and local QA preparation

Published support email support@fam-os.app and website https://fam-os.app/. Saved Productivity category and privacy URL https://fam-os.app/privacy for review. Both privacy and external deletion URLs returned public HTTP 200. The English listing name, core-feature short/full descriptions and existing 512px FamOS icon were saved as a draft; Google confirmed “Your changes have been saved”. Feature graphic and actual Android screenshots remain missing, so the listing is not complete.

Installed the official Android emulator and Android 36 ARM64 AOSP system image using the existing SDK license setup. Also built a local release APK: signature and 16 KB ZIP alignment passed, and its native payload exactly matches the AAB uploaded to Play. Emulator UI control/ADB approval is pending under the computer-use tool rules; no Android runtime test is claimed.
