export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 20.0287,
  longitude: -96.6473
};

const BUSINESS_RADIUS_KM = 8;

export function isInsideServiceArea(
  latitude: number,
  longitude: number
) {
  return distanceInKm(DEFAULT_COORDINATES, { latitude, longitude }) <= BUSINESS_RADIUS_KM;
}

function distanceInKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
