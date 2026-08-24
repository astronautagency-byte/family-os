# FamOS App Store Metadata

This directory contains all the metadata needed for submitting FamOS to the Mac App Store, iOS App Store, and Google Play Store.

## Directory Structure

```
app-store-metadata/
├── README.md                    # This file
├── macos/
│   └── app-store-listing.md    # Mac App Store metadata
├── ios/
│   └── app-store-listing.md    # iOS App Store metadata
└── android/
    └── play-store-listing.md   # Google Play Store metadata
```

## Quick Start

### Mac App Store

1. **Open Xcode Project:**
   ```bash
   open src-tauri/gen/apple/famos.xcodeproj
   ```

2. **Configure Signing:**
   - Select the famos project in Xcode
   - Go to Signing & Capabilities
   - Add your Apple Developer Team
   - Select the appropriate provisioning profile

3. **Build for App Store:**
   ```bash
   ./scripts/build-appstore.sh --profile /path/to/profile.mobileprovision
   ```

4. **Upload to App Store Connect:**
   - Open Transporter.app
   - Drag the .pkg file to Transporter
   - Or use Xcode → Organizer → Distribute App

### iOS App Store

1. **Open Xcode Project:**
   ```bash
   open src-tauri/gen/apple/famos.xcodeproj
   ```

2. **Configure Signing:**
   - Select the famos-iOS target
   - Go to Signing & Capabilities
   - Add your Apple Developer Team
   - Select the appropriate provisioning profile

3. **Build for App Store:**
   ```bash
   cd src-tauri/gen/apple
   xcodebuild -workspace famos.xcworkspace -scheme famos -sdk iphoneos -configuration Release archive -archivePath build/famos.xcarchive
   ```

4. **Upload to App Store Connect:**
   - Open Xcode → Organizer
   - Select the archive
   - Click Distribute App → App Store Connect

### Google Play Store

1. **Create Keystore:**
   ```bash
   keytool -genkey -v -keystore famos.keystore -alias famos -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure Signing:**
   - Edit `src-tauri/gen/android/app/build.gradle.kts`
   - Add keystore configuration

3. **Build for Play Store:**
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
   export ANDROID_HOME=~/Library/Android/sdk
   cd src-tauri/gen/android
   ./gradlew bundleRelease
   ```

4. **Upload to Google Play Console:**
   - Go to https://play.google.com/console
   - Select your app
   - Go to Release → Production
   - Upload the AAB file

## Screenshots

### Required Sizes

**Mac App Store:**
- 1280 x 800 (required)
- 1440 x 900
- 1920 x 1200
- 2560 x 1600

**iOS App Store:**
- iPhone 14 Pro Max: 1290 x 2796
- iPhone 11 Pro Max: 1242 x 2688
- iPhone 8 Plus: 1242 x 2208
- iPad Pro 12.9": 2048 x 2732

**Google Play Store:**
- Phone: 1920 x 1080 (16:9)
- Tablet 7": 1920 x 1200 (16:10)
- Tablet 10": 1920 x 1200 (16:10)
- Feature Graphic: 1024 x 500

### Screenshot Content

1. **Today Dashboard** - Family overview with schedule, tasks, and weather
2. **Calendar View** - Multiple family members' events in one view
3. **Meal Planning** - Weekly meal plan with recipe ideas
4. **Grocery List** - Smart list with categories and focus mode
5. **Family Chat** - Conversation with shared plans
6. **Kitchen Watch** - Inventory tracking with expiry reminders
7. **Task Management** - Assignees and custom lists
8. **Settings** - Family member management and preferences

## Keywords

### Primary Keywords (use in title and subtitle)
- family organizer
- family calendar
- meal planning
- grocery list
- household management

### Long-tail Keywords (use in description)
- shared family calendar app
- meal planning for families
- grocery list for families
- family task manager
- household coordination app
- family schedule organizer
- family meal planner
- family shopping list
- family communication app

### Competitor Keywords
- cozi alternative
- familywall alternative
- famcal alternative
- famcal family calendar

## Privacy Information

### Data Collection
- **Personal Info:** Name, email, phone number
- **Financial Info:** Payment information for subscriptions
- **App Activity:** App interactions, crash logs
- **Device IDs:** User ID, Household ID

### Data Usage
- **App Functionality:** Yes
- **Analytics:** Yes
- **Advertising:** No
- **Developer's Advertising:** No

### Privacy Policy
https://fam-os.app/privacy

## Review Notes

### Test Account
- **Email:** test@fam-os.app
- **Password:** TestPassword123!

### Important Notes
1. App requires internet connection for full functionality
2. Calendar sync requires user authorization
3. AI features require user approval before applying suggestions
4. All data is encrypted in transit and at rest
5. App can be used without an account for exploration
6. Sign-up is free and takes less than 30 seconds

## Submission Checklist

### Mac App Store
- [ ] Apple Developer account active
- [ ] App ID created for `app.famos.desktop`
- [ ] Provisioning profile created
- [ ] Code signing configured
- [ ] Screenshots captured
- [ ] App description written
- [ ] Keywords added
- [ ] Privacy policy URL set
- [ ] Support URL set
- [ ] Marketing URL set
- [ ] In-app purchases configured
- [ ] App review notes prepared
- [ ] Test account credentials provided

### iOS App Store
- [ ] Apple Developer account active
- [ ] App ID created for `app.famos.ios`
- [ ] Provisioning profile created
- [ ] Code signing configured
- [ ] Screenshots captured for all device sizes
- [ ] App description written
- [ ] Keywords added
- [ ] Privacy policy URL set
- [ ] Support URL set
- [ ] Marketing URL set
- [ ] In-app purchases configured
- [ ] App review notes prepared
- [ ] Test account credentials provided

### Google Play Store
- [ ] Google Play Developer account active
- [ ] App created in Play Console
- [ ] Keystore generated
- [ ] Signing configured
- [ ] Screenshots captured
- [ ] Feature graphic created
- [ ] App description written
- [ ] Keywords added
- [ ] Privacy policy URL set
- [ ] Support email set
- [ ] In-app products configured
- [ ] Content rating completed
- [ ] Data safety section completed
- [ ] Test account credentials provided

## Localization

### Supported Languages
- English (US) - Primary
- English (UK)
- Spanish (ES)
- French (FR)
- German (DE)
- Japanese (JA)
- Portuguese (BR)

### Localization Files
Each language should have:
- Short description
- Full description
- Keywords
- Promotional text
- What's new text

## Additional Resources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policy](https://developer.google.com/google-play/android-developer-policy-guideline)
- [App Store Optimization Guide](https://www.apptweak.com/en/aso-blog/app-store-optimization-aso-guide)
- [Tauri iOS Documentation](https://tauri.app/start/prerequisites/#ios)
- [Tauri Android Documentation](https://tauri.app/start/prerequisites/#android)
