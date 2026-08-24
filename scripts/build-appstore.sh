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
#   APPLE_SIGNING_IDENTITY  — e.g. "Apple Development: Alex Vorobiev (TEAMID)"
#   APPLE_TEAM_ID           — your 10-character Apple Developer Team ID
#   APPLE_PROVIDER_SHORT_NAME — e.g. "XXXXXXXXXX" (optional, for Xcode 15+)

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
TEAM_ID="${APPLE_TEAM_ID:-}"
PROVIDER="${APPLE_PROVIDER_SHORT_NAME:-}"
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
  echo "It should look like: \"Apple Development: Name (TEAMID)\""
  exit 1
fi

if [[ -z "$TEAM_ID" ]]; then
  echo "❌ APPLE_TEAM_ID not set."
  echo "   Find it at: https://developer.apple.com/account → Membership"
  exit 1
fi

echo "📋 Configuration:"
echo "   Signing:    $SIGNING_IDENTITY"
echo "   Team ID:    $TEAM_ID"
echo "   Profile:    ${PROFILE:-auto}"
echo ""

# ── Find provisioning profile ──
if [[ -z "$PROFILE" ]]; then
  # Look for a provisioning profile for app.famos.desktop
  PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
  if [[ -d "$PROFILE_DIR" ]]; then
    for p in "$PROFILE_DIR"/*.mobileprovision; do
      if [[ -f "$p" ]]; then
        # Check if this profile is for our app
        PLIST=$(security cms -D -i "$p" 2>/dev/null || true)
        if echo "$PLIST" | grep -q "app.famos.desktop"; then
          PROFILE="$p"
          echo "   Found profile: $(basename "$p")"
          break
        fi
      fi
    done
  fi

  if [[ -z "$PROFILE" ]]; then
    echo "⚠️  No provisioning profile found for app.famos.desktop"
    echo ""
    echo "   To create one:"
    echo "   1. Go to https://developer.apple.com/account/resources/profiles"
    echo "   2. Click '+' → App Store → macOS → app.famos.desktop"
    echo "   3. Download and double-click to install"
    echo "   4. Re-run this script"
    echo ""
    echo "   Or specify manually: ./scripts/build-appstore.sh --profile /path/to/profile.mobileprovision"
    exit 1
  fi
fi

# ── Build the frontend ──
echo "🔨 Building frontend..."
npm run build

# ── Build the Tauri app for App Store ──
echo ""
echo "🦀 Building Tauri app for App Store..."

# For App Store, we need to build with the correct target
# Tauri 2 uses --target for the build
ARCH="${ARCH:-aarch64-apple-darwin}"

npx tauri build \
  --target "$ARCH" \
  --bundles app \
  --config "{\"bundle\":{\"macOS\":{\"signingIdentity\":\"$SIGNING_IDENTITY\",\"providerShortName\":\"$PROVIDER\",\"entitlements\":\"./FamOS.entitlements\"}}}" \
  2>&1

# ── Find the built .app ──
APP_PATH=$(find "src-tauri/target/$ARCH/release/bundle/macos" -maxdepth 1 -name '*.app' -type d -print -quit 2>/dev/null || true)

if [[ -z "$APP_PATH" ]]; then
  echo "❌ Build failed — no .app bundle found"
  exit 1
fi

echo ""
echo "✅ Built: $APP_PATH"

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
  --sign "3rd Party Mac Developer Installer: $SIGNING_IDENTITY" \
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
  echo "   1. Xcode → Organizer → Distribute App → App Store Connect"
  echo "   2. Or: xcrun altool --upload-package \"$PKG_FILE\" \\"
  echo "          --type ios --apiKey \"...\" --apiIssuer \"...\""
  echo ""
  echo "   Or drag the .app to Transporter.app"
else
  echo "   ⚠️  .pkg creation failed (may need installer certificate)"
  echo "   You can still upload the .app directly via Transporter.app"
fi

echo ""
echo "Done! 🎉"
