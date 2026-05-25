export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 20.0287,
  longitude: -96.6473
};

export function isInsideServiceArea(
  latitude: number,
  longitude: number
) {
  return (
    latitude >= 19.95 &&
    latitude <= 20.10 &&
    longitude >= -96.75 &&
    longitude <= -96.55
  );
}
