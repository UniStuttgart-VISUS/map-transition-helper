// two-dimensional Cartesian point
export interface Point2D {
  x: number;
  y: number;
}

// three-dimensional Cartesian point
export type Point3D = Point2D & {
  z: number;
};

// two-dimensional geographical coordinate
export interface Coordinate {
  lat: number;
  lng: number;
}

// describing a point on the map by its latitude, longitude and zoom value
export type ViewPoint = Coordinate & {
  zoom: number;
};
