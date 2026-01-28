# 🪴

A minimal dark mode plant care app for iOS & Android. Track your plants, identify species with AI, and never miss a watering.

## Features

- 🌑 **Dark mode** - Sleek minimal interface
- 📷 **Plant identification** - AI-powered species recognition
- 💧 **Smart watering** - Schedule with soil moisture deferrals
- 🔔 **Push notifications** - Watering reminders
- 📱 **Cross-platform** - iOS & Android

## Quick Start

```bash
npm install
npm run web        # Browser (fastest dev)
npm start          # Expo Go on phone (best for camera)
npm run ios        # iOS Simulator
npm run android    # Android Emulator
```

Open http://localhost:8081 in browser for web development.

## Plant Identification (Gemini AI)

The app uses Google Gemini AI for plant identification. It works with mock data by default.

To enable real AI identification:

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Update `src/services/gemini.ts`:
   ```typescript
   const GEMINI_API_KEY = 'your_api_key_here';
   ```

The AI identifies:
- Plant species (scientific & common name)
- Watering frequency recommendations
- Sunlight requirements
- Care difficulty level
- Care instructions

## Notifications

Watering reminders are automatically scheduled at 9 AM on each plant's watering day. Notifications work on physical devices only.

## Project Structure

```
src/
├── screens/          # UI screens
│   ├── HomeScreen.tsx
│   ├── AddPlantScreen.tsx
│   └── PlantDetailScreen.tsx
├── services/         # Business logic
│   ├── storage.ts           # AsyncStorage
│   ├── gemini.ts            # Google Gemini AI plant ID
│   └── notifications.ts     # Push notifications
├── theme/
│   └── colors.ts            # Dark mode colors
├── types/
│   └── plant.ts             # TypeScript types
└── utils/
    └── dateUtils.ts         # Date helpers
```

## Tech Stack

- React Native (Expo)
- TypeScript
- React Navigation
- Google Gemini AI (2.0 Flash)
- Expo Notifications
- AsyncStorage

## Theme

Edit `src/theme/colors.ts` to customize the dark mode color scheme.

Current palette:
- Background: `#0a0a0a`
- Surface: `#1a1a1a`
- Primary: `#00ff88` (bright green)
- Text: `#ffffff`

## Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS/Android
eas build --platform ios
eas build --platform android
```
