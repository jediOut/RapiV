const { expo } = require("./app.json");

const nativeBuildProfiles = new Set(["development", "google-play-test", "production"]);
const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

if (nativeBuildProfiles.has(process.env.EAS_BUILD_PROFILE) && !googleMapsAndroidApiKey) {
  throw new Error(
    "Missing GOOGLE_MAPS_ANDROID_API_KEY. Create a restricted Android Maps SDK key and set it before building."
  );
}

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      config: {
        ...expo.android?.config,
        googleMaps: {
          ...expo.android?.config?.googleMaps,
          apiKey: googleMapsAndroidApiKey ?? ""
        }
      }
    }
  }
};
