import { VEGA_SERVICE_address } from "./serviceAddress";

export const VEGA_CAMERA_BOUNDARY = {
  northEast: {
    latitude: 20.19,
    longitude: -96.43
  },
  southWest: {
    latitude: 19.86,
    longitude: -96.86
  }
};

export const VEGA_MAP_LIMITS = {
  minZoomLevel: 11,
  maxZoomLevel: 18
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function clampToVegaBounds(coordinate: Coordinate): Coordinate {
  return {
    latitude: Math.min(
      VEGA_CAMERA_BOUNDARY.northEast.latitude,
      Math.max(VEGA_CAMERA_BOUNDARY.southWest.latitude, coordinate.latitude)
    ),
    longitude: Math.min(
      VEGA_CAMERA_BOUNDARY.northEast.longitude,
      Math.max(VEGA_CAMERA_BOUNDARY.southWest.longitude, coordinate.longitude)
    )
  };
}

export function regionInVega(coordinate: Coordinate, delta = 0.02) {
  return {
    ...clampToVegaBounds(coordinate),
    latitudeDelta: delta,
    longitudeDelta: delta
  };
}

export function defaultVegaRegion(delta = 0.35) {
  return {
    ...VEGA_SERVICE_address,
    latitudeDelta: delta,
    longitudeDelta: delta
  };
}
