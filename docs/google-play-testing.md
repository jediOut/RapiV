# Google Play testing setup

RapiV has three Android apps, so Google Play Console needs three separate apps:

- RapiV Cliente: `com.rapiv.client`
- RapiV Negocios: `com.rapiv.business`
- RapiV Repartidor: `com.rapiv.courier`

## Recommended track

Start with Internal testing. It is the fastest track to share builds with trusted testers.

If the Play Console account is a new personal developer account, Google requires a Closed testing run before production access:

- At least 12 testers opted in.
- Testers must remain opted in for at least 14 continuous days.
- Closed testing can start after the app setup is complete.

Internal testing is still useful first because it can be used before the app setup is fully complete.

## Play Console account setup

1. Create or open the Google Play Console developer account.
2. Complete developer identity verification.
3. Create each app in Play Console with the package names listed above.
4. Complete the app setup sections required by Play Console:
   - App access.
   - Ads declaration.
   - Content rating.
   - Target audience.
   - Data safety.
   - Privacy policy URL.
   - Store listing.
5. Add internal testers by email or Google Group.
6. Upload an Android App Bundle to Internal testing.
7. Publish the internal testing release and share the opt-in link with testers.

## Build Android App Bundles

From each app folder:

```powershell
npx eas-cli build --platform android --profile google-play-test
```

Cliente:

```powershell
cd C:\jediApps\RapiV\cliente-frontend
npx eas-cli build --platform android --profile google-play-test
```

Negocio:

```powershell
cd C:\jediApps\RapiV\negocio-frontend
npx eas-cli build --platform android --profile google-play-test
```

Repartidor:

```powershell
cd C:\jediApps\RapiV\repartidor-frontend
npx eas-cli build --platform android --profile google-play-test
```

## Submit to internal testing

Manual path:

1. Download the `.aab` from EAS.
2. Open Play Console.
3. Go to the app.
4. Go to Test and release > Testing > Internal testing.
5. Create a new release.
6. Upload the `.aab`.
7. Review and roll out the internal test.

EAS submit path, after configuring a Google service account:

```powershell
npx eas-cli submit --platform android --profile google-play-test
```

## Version updates

Every new Google Play upload must increase `android.versionCode` in the app's `app.json`.

Current starting version codes:

- Cliente: `1`
- Negocio: `1`
- Repartidor: `1`

For the next upload, increment to `2`, then `3`, and so on.

## Google Sign-In reminder

After creating OAuth clients in Google Cloud, set these environment variables before building:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

## Google Maps reminder

Before building `repartidor-frontend` for Google Play, create a Google Maps API key in Google Cloud:

1. Enable **Maps SDK for Android** in the same Google Cloud project.
2. Restrict the key to Android apps.
3. Add package name `com.rapiv.courier`.
4. Add the Play App Signing SHA-1 from Play Console > App integrity > App signing key certificate.
5. Set the key before running EAS:

```powershell
$env:GOOGLE_MAPS_ANDROID_API_KEY="your-restricted-maps-key"
```

Also add every Google OAuth client ID to staging backend:

```text
GOOGLE_CLIENT_IDS=id1.apps.googleusercontent.com,id2.apps.googleusercontent.com,id3.apps.googleusercontent.com
```
