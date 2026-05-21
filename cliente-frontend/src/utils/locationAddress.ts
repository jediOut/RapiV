import * as Location from 'expo-location';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export async function resolveAddressFromCoordinates(coordinates: Coordinates) {
  try {
    const result = await Location.reverseGeocodeAsync(coordinates);
    const place = result[0];

    if (!place) {
      return null;
    }

    const address = [
      place.street,
      place.streetNumber,
      place.district,
      place.city,
      place.region,
      place.postalCode,
    ]
      .filter(Boolean)
      .join(', ');

    return address || null;
  } catch {
    return null;
  }
}
