# Location Tracker mobile app

Native iPhone/iPad + Android companion app for the existing Location Tracker website.

## What it does

- Uses the existing Supabase project and custom account/session RPCs.
- Lets a user sign in with the same Location Tracker username/password.
- Starts a real background location task.
- Sends location updates to the existing `save_my_location` RPC.
- Lets friends see the latest location through the existing `list_friends` RPC.
- Keeps the last known location visible when a friend stops sharing.
- Includes Find Me and friend location controls.

## Important

A normal GitHub Pages website cannot continuously send GPS after its page is closed. This native app uses iOS/Android background location APIs instead.

On iPhone/iPad, the user must grant **Always** location permission when prompted and keep Location Sharing enabled. iOS controls when background updates are delivered, so this is not guaranteed to update every few seconds.

On Android, Location Tracker uses a foreground location service while sharing is enabled. The operating system may still apply battery restrictions.

## Build from an iPad

This repository is designed to be built with Expo/EAS from a cloud development environment. Expo Go is not enough for reliable background-location testing; use an EAS development build or a production build.

From the `location-tracker-mobile` directory:

```
npm install
npx expo start
```

For an actual installable iOS/Android build, use EAS Build with an Expo account. iOS distribution requires Apple developer signing.

## Supabase

The app uses:

- `current_account`
- `login_account`
- `logout_account`
- `save_my_location`
- `stop_my_location`
- `my_location_status`
- `list_friends`
- `add_friend`
- `remove_friend`

The publishable Supabase key is safe to ship in a client app only when the database/RPC security rules are correctly enforced. Never put a Supabase service-role key in this app.
