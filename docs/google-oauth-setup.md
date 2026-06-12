# Google OAuth setup

This app uses Google OpenID Connect for sign-in:

1. The mobile app opens Google Sign-In with `expo-auth-session`.
2. Google returns an `id_token`.
3. The app sends that token to `POST /api/auth/google`.
4. The backend verifies the token with Google and issues the normal RapiV JWT.

## App identifiers

Use these app identifiers when creating OAuth clients:

| App | Android package | iOS bundle ID | Expo scheme |
| --- | --- | --- | --- |
| Cliente | `com.rapiv.client` | `com.rapiv.client` | `rapiv` |
| Negocios | `com.rapiv.business` | `com.rapiv.business` | `rapiv-negocio` |
| Repartidor | `com.rapiv.courier` | `com.rapiv.courier` | `rapiv-repartidor` |

## Google Cloud steps

1. Open Google Cloud Console.
2. Create or select the RapiV project.
3. Go to APIs & Services > OAuth consent screen.
4. Configure the consent screen:
   - App name: `RapiV`
   - User support email: your support email.
   - Developer contact email: your developer email.
   - User type: External.
5. While testing, add your Google account under Test users.
6. Go to APIs & Services > Credentials.
7. Create OAuth client IDs.

Create these clients for Android testing:

- Web application client.
- Android client for Cliente.
- Android client for Negocios.
- Android client for Repartidor.

Create these clients before testing on iOS:

- iOS client for Cliente.
- iOS client for Negocios.
- iOS client for Repartidor.

## Android SHA-1

For Android OAuth clients, Google requires package name and SHA-1 certificate fingerprint.

For local/dev builds, get credentials from EAS:

```powershell
cd C:\jediApps\RapiV\cliente-frontend
npx eas-cli credentials -p android
```

Repeat for each app folder. Use the SHA-1 shown for the app's Android OAuth client.

When Google Play App Signing is configured, also add the Play Console app signing SHA-1 to the matching Android OAuth client.

## Environment variables

Each Android frontend build needs:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` can stay empty only while you are not testing on iOS. On iOS, `expo-auth-session/providers/google` requires `iosClientId`; without it the Google button stays disabled.

The backend needs every allowed Google OAuth client ID:

```text
GOOGLE_CLIENT_IDS=web.apps.googleusercontent.com,android-client.apps.googleusercontent.com
```

For staging, edit:

```text
/opt/rapiv/deploy/staging.env
```

Then restart backend:

```bash
cd /opt/rapiv
sudo docker compose -f docker-compose.staging.yml up -d backend
```

## Testing notes

Expo Go is not reliable for this OAuth flow because custom app schemes cannot be fully controlled there. Use an EAS development build or a Google Play internal/closed testing build.

The Google button remains disabled until at least one frontend Google client ID is configured.
