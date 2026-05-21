import { BadRequestException } from "@nestjs/common";

export const VEGA_DE_ALATORRE_CENTER = {
  latitude: 20.0289,
  longitude: -96.6472
};

export const VEGA_DE_ALATORRE_SERVICE_RADIUS_KM = 35;

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function assertInsideVegaServiceaddress(location: Coordinates): void {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    throw new BadRequestException("Invalid coordinates");
  }

  const distance = distanceInKm(VEGA_DE_ALATORRE_CENTER, location);

  if (distance > VEGA_DE_ALATORRE_SERVICE_RADIUS_KM) {
    throw new BadRequestException("Location is outside Vega de Alatorre service address");
  }
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
