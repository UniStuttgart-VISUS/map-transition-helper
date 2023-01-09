import { geoMercator } from 'd3-geo';
import type { FeatureCollection } from 'geojson';

import type { Coordinate, Point2D } from './points';

// default margin for minZoom functions
const fitMargin = 20;

/**
 * Calculate the minimal zoom level, centered on `center` on a canvas of size
 * `canvasSize`, such that `outer` is visible `margin` pixels from the canvas
 * edge.
 *
 * @param center      Center of the map
 * @param outer       Other point that should be visible
 * @param canvasSize  Size of the canvas
 * @param margin (optional)   Distance of `outer` from the edge in pixels,
 *                            default 20
 * @returns n         The minimal (strictly: maximal) zoom level that satisfies
 *                    the condition
 */
export function calcMinZoomCenteredOn(
  center: Coordinate,
  outer: Coordinate,
  canvasSize: Point2D,
  margin: number = fitMargin,
): number {
  const proj = geoMercator();

  // create point that such that `center` is between it and `outer` in the
  // image space
  const [xCenter, yCenter] = proj([center.lng, center.lat]) ?? [0, 0];
  const [xOuter, yOuter] = proj([outer.lng, outer.lat]) ?? [1, 1];
  const dPaddingX = xOuter - xCenter;
  const dPaddingY = yOuter - yCenter;

  const [lng1, lat1] = proj.invert?.([xCenter + dPaddingX, yCenter + dPaddingY]) ?? [0, 0];
  const [lng2, lat2] = proj.invert?.([xCenter - dPaddingX, yCenter - dPaddingY]) ?? [1, 1];

  return calcZoomFitPoints(
    [
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    ],
    canvasSize,
    margin,
  );
}

/**
 * Calculate the minimal (maximal) zoom level such that all `coordinates` are still visible in a map with size `canvasSize`, with all points at least `margin` pixels from the edge of the canvas.
 *
 * @param coordinates   Array of coordinates that should be visible
 * @param canvasSize    Size of canvas
 * @param margin (optional)   Minimum distance of coordinates from the edge of
 *                            the canvas in pixels, default 20
 */
export function calcZoomFitPoints(
  coordinates: Array<Coordinate>,
  canvasSize: Point2D,
  margin: number = fitMargin,
): number {
  const proj = geoMercator();

  if (coordinates.length < 2)
    throw new Error('calcZoomFitPoints must be passed at least two points');

  // fit projection
  const geoJson: FeatureCollection = {
    type: 'FeatureCollection',
    features: coordinates.map(({ lat, lng }) => {
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      };
    }),
  };
  proj.fitExtent(
    [
      [margin, margin],
      [canvasSize.x - margin, canvasSize.y - margin],
    ],
    geoJson,
  );

  return Math.log2((proj.scale() / 256) * 2 * Math.PI);
}
