# Location Tracker Custom Accounts

This version does not use Supabase Auth. It has its own account creation, login, and session system backed by the database. Passwords are hashed with PostgreSQL `crypt`; the plain password is not stored.

Upload these files to GitHub Pages. Use the HTTPS Pages URL because browser location access requires a secure context.
