# Location Tracker Custom Accounts

Location Tracker is a GitHub Pages-friendly location sharing app backed by Supabase.

## Features

- Custom username/password accounts
- Start and stop your own location sharing
- Add friends by username
- See friends who are currently sharing on the map
- See when a friend is not sharing
- Remove friends
- Automatically refresh friend markers every 10 seconds
- Mobile-friendly map and controls
- PWA/service-worker support

## Supabase

The app uses the custom accounts + sessions model already configured in the project. Passwords are hashed in PostgreSQL and the browser only receives a session token.

The SQL fix is versioned in supabase/migrations/20261004_fix_friend_location_functions.sql.

## GitHub Pages

Use the HTTPS GitHub Pages URL because browser geolocation requires a secure context.
