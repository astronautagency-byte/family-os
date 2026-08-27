#!/bin/bash
set -euo pipefail

# ─── FamOS Mac App Store Build Script ───
# Builds a signed .app bundle for Mac App Store submission.
# Requires: Xcode, Apple Developer account, provisioning profile.
#
# Usage:
#   ./scripts/build-appstore.sh [--profile NAME]
#
# Environment variables:
#   APPLE_SIGNING_IDENTITY  — e.g. "3rd Party Mac Developer Application: Alex Vorobiev (TEAMID)"
#   APPLE_INSTALLER_IDENTITY — e.g. "3rd Party Mac Developer Installer: Alex Vorobiev (TEAMID)"
#   APPLE_TEAM_ID           — your 10-character Apple Developer Team ID
#   APPLE_PROVIDER_SHORT_NAME — e.g. "XXXXXXXXXX" (optional, for Xcode 15+)

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
INSTALLER_IDENTITY="${APPLE_INSTALLER_IDENTITY:-}"
TEAM_ID="${APPLE_TEAM_ID:-}"
PROVIDER="${APPLE_PROVIDER_SHORT_NAME:-}"
BUILD_NUMBER="${APP_BUILD_NUMBER:-2}"
PROFILE=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "╔══════════════════════════════════════════════════╗"
echo "║     FamOS — Mac App Store Build                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Validate prerequisites ──
if [[ -z "$SIGNING_IDENTITY" ]]; then
  echo "❌ APPLE_SIGNING_IDENTITY not set."
  echo ""
  echo "Find your identity:"
  echo "  security find-identity -v -p codesigning"
  echo ""
  echo "It should look like: \"3rd Party Mac Developer Application: Name (TEAMID)\""
  exit 1
fi

if [[ -z "$INSTALLER_IDENTITY" ]]; then
  echo "❌ APPLE_INSTALLER_IDENTITY not set."
  echo "   It should look like: \"3rd Party Mac Developer Installer: Name (TEAMID)\""
  exit 1
fi

if [[ -z "$TEAM_ID" ]]; then
  echo "❌ APPLE_TEAM_ID not set."
  echo "   Find it at: https://developer.apple.com/account → Membership"
  exit 1
fi

echo "📋 Configuration:"
echo "   Signing:    $SIGNING_IDENTITY"
echo "   Installer:  $INSTALLER_IDENTITY"
echo "   Team ID:    $TEAM_ID"
echo "   Profile:    ${PROFILE:-auto}"
echo ""

# ── Find provisioning profile ──
if [[ -z "$PROFILE" ]]; then
  # Xcode 16+ stores profiles under Library/Developer; older Xcode releases
  # used Library/MobileDevice. Check both locations.
  PROFILE_DIRS=(
    "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
    "$HOME/Library/MobileDevice/Provisioning Profiles"
  )
  for PROFILE_DIR in "${PROFILE_DIRS[@]}"; do
    [[ -d "$PROFILE_DIR" ]] || continue
    for p in "$PROFILE_DIR"/*.provisionprofile "$PROFILE_DIR"/*.mobileprovision; do
      if [[ -f "$p" ]]; then
        # Check if this profile is for our app
        PLIST=$(security cms -D -i "$p" 2>/dev/null || true)
        if echo "$PLIST" | grep -q "app.fam-os.famos" && echo "$PLIST" | grep -q "Mac App Store"; then
          PROFILE="$p"
          echo "   Found profile: $(basename "$p")"
          break
        fi
      fi
    done
    [[ -n "$PROFILE" ]] && break
  done

  if [[ -z "$PROFILE" ]]; then
    echo "⚠️  No Mac App Store provisioning profile found for app.fam-os.famos"
    echo ""
    echo "   To create one:"
    echo "   1. Go to https://developer.apple.com/account/resources/profiles"
    echo "   2. Click '+' → Mac App Store → app.fam-os.famos"
    echo "   3. Download and double-click to install"
    echo "   4. Re-run this script"
    echo ""
    echo "   Or specify manually: ./scripts/build-appstore.sh --profile /path/to/profile.mobileprovision"
    exit 1
  fi
fi

# ── Build the frontend ──
echo "🔨 Building frontend..."
export VITE_DISTRIBUTION=mac-app-store
npm run build:mac-app-store

# ── Build the Tauri app for App Store ──
echo ""
echo "🦀 Building Tauri app for App Store..."

# For App Store, we need to build with the correct target
# Tauri 2 uses --target for the build
ARCH="${ARCH:-aarch64-apple-darwin}"

npx tauri build \
  --target "$ARCH" \
  --bundles app \
  --config "{\"bundle\":{\"macOS\":{\"signingIdentity\":\"$SIGNING_IDENTITY\",\"providerShortName\":\"$PROVIDER\",\"entitlements\":\"./FamOS-AppStore.entitlements\",\"bundleVersion\":\"$BUILD_NUMBER\",\"minimumSystemVersion\":\"12.0\"}}}" \
  2>&1

# ── Find the built .app ──
APP_PATH=$(find "src-tauri/target/$ARCH/release/bundle/macos" -maxdepth 1 -name '*.app' -type d -print -quit 2>/dev/null || true)

if [[ -z "$APP_PATH" ]]; then
  echo "❌ Build failed — no .app bundle found"
  exit 1
fi

echo ""
echo "✅ Built: $APP_PATH"

# A Mac App Store app must contain its distribution provisioning profile.
cp "$PROFILE" "$APP_PATH/Contents/embedded.provisionprofile"
# Browser-downloaded profiles carry com.apple.quarantine. App Store Connect
# rejects any quarantined file in the payload, so clear extended attributes
# before applying the final signature.
xattr -cr "$APP_PATH"
codesign --force --options runtime --timestamp \
  --requirements '=designated => anchor apple generic and identifier "app.fam-os.famos"' \
  --entitlements "src-tauri/FamOS-AppStore.entitlements" \
  --sign "$SIGNING_IDENTITY" "$APP_PATH"

if xattr -lr "$APP_PATH" | grep -q 'com.apple.quarantine'; then
  echo "❌ Quarantine attribute remains in the app bundle"
  exit 1
fi

# ── Verify signing ──
echo ""
echo "🔍 Verifying code signature..."
codesign --verify --deep --strict --verbose=4 "$APP_PATH" && echo "   ✅ Signature valid" || echo "   ⚠️  Signature verification failed"

# ── Verify entitlements ──
echo ""
echo "📋 Entitlements:"
codesign -d --entitlements - "$APP_PATH" 2>/dev/null | head -20

# ── Create .pkg for App Store submission ──
echo ""
echo "📦 Creating .pkg for App Store..."

PKG_PATH="src-tauri/target/$ARCH/release/bundle/pkg"
mkdir -p "$PKG_PATH"

# Use productbuild to create the installer package
APP_NAME=$(basename "$APP_PATH" .app)
PKG_FILE="$PKG_PATH/${APP_NAME}.pkg"

productbuild \
  --component "$APP_PATH" /Applications \
  --sign "$INSTALLER_IDENTITY" \
  --timestamp \
  "$PKG_FILE" \
  2>&1

if [[ -f "$PKG_FILE" ]]; then
  echo "   ✅ Created: $PKG_FILE"
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  Ready to upload to App Store Connect!          ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
  echo "   Upload via:"
  echo "   1. Open Transporter and choose $PKG_FILE"
  echo "   2. Or upload with Apple's Transporter command-line tool and an App Store Connect API key"
  echo ""
  echo "   Or drag the .app to Transporter.app"
else
  echo "   ⚠️  .pkg creation failed (may need installer certificate)"
  echo "   A signed installer package is required for the Mac App Store."
fi

echo ""
echo "Done! 🎉"
