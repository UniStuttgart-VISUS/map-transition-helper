import { geoMercator } from 'd3-geo';

import { calculateFrame } from '.';
import type { Point2D, ViewPoint } from './points';
import type { TransitionFunction } from './transition-function';
import {
  createPanning,
  createTransitionFunction,
  createZoom,
  joinTransitions,
} from './transition-function';
import { calcMinZoomCenteredOn, calcZoomFitPoints } from './utils';

/**
 * Create a linear panning transition without zooming. The zoom level of the
 * first view point will be used throughout.
 *
 * @param p0    Start point
 * @param p1    End point
 * @returns f   Transition that pans linearly from `p0` to `p1`
 */
export function createLinearPanTransition(p0: ViewPoint, p1: ViewPoint): TransitionFunction {
  return createTransitionFunction(createPanning(p0, p1), (_) => p0.zoom);
}

/**
 * Create a linear pan and zoom. Can also be used to just zoom.
 *
 * NOTE: In some cases, this is probably not what you want: Zooming is linear
 * in the zoom level, but panning speed then needs to scale with the current
 * zoom level so that it is perceived as linear. For zoom+pan transitions, use
 * `createPerceivedLinearZoomAndPanTransition` instead.
 *
 * @param p0    Start point
 * @param p1    End point
 * @returns f   Transition that pans and zooms linearly from `p0` to `p1`
 */
export function createLinearZoomAndPanTransition(p0: ViewPoint, p1: ViewPoint): TransitionFunction {
  return createTransitionFunction(createPanning(p0, p1), createZoom(p0.zoom, p1.zoom));
}

/**
 * Create a pan and zoom transition that is perceived as being linear. The
 * panning will depend on the zoom level.
 *
 * @param p0    Start point
 * @param p1    End point
 * @returns f   Transition that pans and zooms from `p0` to `p1`
 */
export function createPerceivedLinearZoomAndPanTransition(
  p0: ViewPoint,
  p1: ViewPoint,
): TransitionFunction {
  const pan = createPanning(p0, p1);
  const zoom = createZoom(p0.zoom, p1.zoom);

  const z0 = Math.pow(2, -p0.zoom);
  const z1 = Math.pow(2, -p1.zoom);

  return function (t: number): ViewPoint {
    const z = zoom(t);
    const z_ = Math.pow(2, -z);
    const tx = (z_ - z0) / (z1 - z0);
    const { lat, lng } = pan(tx);

    return { lat, lng, zoom: z };
  };
}

/**
 * Create a box transition: zoom out from `p0` until `p1` is visible. Then pan
 * to `p1`. Then zoom into `p1`.
 *
 * @param p0                  Start point
 * @param p1                  End point
 * @param canvasSize          Size of the canvas the transition will run on
 * @param minZoom (optional)  Zoom level for panning phase. If not given, will
 *                            be calculated to fit.
 * @returns f                 Box transition from `p0` to `p1`
 */
export function createBoxTransition(
  p0: ViewPoint,
  p1: ViewPoint,
  canvasSize: Point2D,
  minZoom?: number,
): TransitionFunction {
  const z1 = minZoom ?? Math.min(calcMinZoomCenteredOn(p0, p1, canvasSize), p0.zoom, p1.zoom);

  return joinTransitions([
    createLinearZoomAndPanTransition(p0, { ...p0, zoom: z1 }),
    createLinearPanTransition({ ...p0, zoom: z1 }, { ...p1, zoom: z1 }),
    createLinearZoomAndPanTransition({ ...p1, zoom: z1 }, p1),
  ]);
}

/**
 * Create a (perceived) triangular transition: Zoom out and pan from `p0` to
 * the midpoint between `p0` and `p1` in the image space, at which time both
 * `p0` and `p1` will be visible. Then, continue panning and zooming in again
 * until centered on `p1`.
 *
 * @param p0                  Start point
 * @param p1                  End point
 * @param canvasSize          Size of the canvas the transition will run on
 * @param minZoom (optional)  Zoom level for panning phase. If not given, will
 *                            be calculated to fit.
 * @returns f                 Triangular transition from `p0` to `p1`
 */
export function createTriangularTransition(
  p0: ViewPoint,
  p1: ViewPoint,
  canvasSize: Point2D,
  minZoom?: number,
): TransitionFunction {
  const z1 = minZoom ?? Math.min(calcZoomFitPoints([p0, p1], canvasSize), p0.zoom, p1.zoom);

  const mid = createPanning(p0, p1)(0.5);
  const midViewpoint = { ...mid, zoom: z1 };

  return joinTransitions([
    createPerceivedLinearZoomAndPanTransition(p0, midViewpoint),
    createPerceivedLinearZoomAndPanTransition(midViewpoint, p1),
  ]);
}

/**
 * Create a transition following the hyperbolic path recommended by van Wijk
 * and Nuij: "Smooth and efficient zooming and panning" (Proc. InfoVis, 2003).
 *
 * Note: As of now, this library only supports Mercator projection. This
 * transition should be done in image space, even if the `TransitionFunction`
 * outputs geographical space ViewPoints. For now, this function will assume
 * Mercator projection is used for its internal calculations. This should be
 * amended once different projections are supported.
 *
 * @param p0                  Start point
 * @param p1                  End point
 * @param canvasSize          Size of the canvas the transition will run on
 * @param rho (optional)      Parameter ρ, which determines the shape of the
 *                            hyperbolic path in (u, w) space (see the paper).
 *                            If not passed, the recommended value of 1.4 is
 *                            used. be calculated to fit.
 * @returns f                 Hyperbolic transition from `p0` to `p1`
 */
export function createVanWijkAndNuijTransition(
  p0: ViewPoint,
  p1: ViewPoint,
  canvasSize: Point2D,
  rho = 1.4,
): TransitionFunction {
  const mercator = geoMercator();
  if (!mercator.invert) throw new Error('Mercator projection cannot be inverted');

  mercator.fitExtent(
    [
      [0, 0],
      [canvasSize.x, canvasSize.y],
    ],
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [p0.lng, p0.lat],
              [p1.lng, p1.lat],
            ],
          },
        },
      ],
    },
  );

  const baseScale = mercator.scale();
  const zoomFactor0 = Math.pow(2, p0.zoom + 8) / (2 * Math.PI) / baseScale;
  const zoomFactor1 = Math.pow(2, p1.zoom + 8) / (2 * Math.PI) / baseScale;

  mercator.translate([0, 0]).scale(1);

  const xy0 = mercator([p0.lng, p0.lat]);
  const xy1 = mercator([p1.lng, p1.lat]);
  if (xy0 === null || xy1 === null) throw new Error('cannot project start or end point');

  const [x0, y0] = xy0;
  const [x1, y1] = xy1;

  const u0 = 0;
  const u1 = Math.sqrt(Math.pow(x0 - x1, 2) + Math.pow(y0 - y1, 2));

  // w0, w1 are dependent on distance between p0 and p1
  const w0 = (1 / zoomFactor0) * u1;
  const w1 = (1 / zoomFactor1) * u1;

  const movementDirection = Math.atan2(y1 - y0, x1 - x0);
  const factorX = Math.cos(movementDirection);
  const factorY = Math.sin(movementDirection);

  const canvasWidth = canvasSize.x;
  const f0 = calculateFrame(canvasSize, p0);
  const f1 = calculateFrame(canvasSize, p1);
  const borderPosition0 = f0.borderPosition(p1);
  const borderPosition1 = f1.borderPosition(p0);

  // u1 is calculated assuming a motion over the total horizontal width. Zoom
  // out further if the motion is along the shorter side.
  const motionDiagonal = Math.sqrt(
    Math.pow(borderPosition0.x - borderPosition1.x, 2) +
      Math.pow(borderPosition0.y - borderPosition1.y, 2),
  );
  const motionScale = canvasWidth / motionDiagonal;

  const b0 = (w1 ** 2 - w0 ** 2 + rho ** 4 * (u1 - u0) ** 2) / (2 * w0 * rho ** 2 * (u1 - u0));
  const b1 = (w1 ** 2 - w0 ** 2 + -1 * rho ** 4 * (u1 - u0) ** 2) / (2 * w1 * rho ** 2 * (u1 - u0));

  const r0 = Math.log(-b0 + Math.sqrt(b0 ** 2 + 1));
  const r1 = Math.log(-b1 + Math.sqrt(b1 ** 2 + 1));

  const S = (r1 - r0) / rho;

  const u = (s: number): number => {
    return (
      (w0 / rho ** 2) * Math.cosh(r0) * Math.tanh(rho * s + r0) -
      (w0 / rho ** 2) * Math.sinh(r0) +
      u0
    );
  };

  const w = (s: number): number => {
    return (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0);
  };

  const position = (t: number): Point2D => {
    const s = t * S;
    const u_ = u(s);
    return {
      x: x0 + factorX * u_,
      y: y0 + factorY * u_,
    };
  };

  const zoom = (t: number): number => {
    const s = t * S;
    const w_ = w(s);
    const wNorm = Math.log2(w0 / (w_ * motionScale));
    const zoomLevel = p0.zoom + wNorm;

    return zoomLevel;
  };

  return (t: number): ViewPoint => {
    const { x, y } = position(t);
    const zoom_ = zoom(t);

    const pos = mercator.invert?.([x, y]) ?? null;
    if (pos === null) throw new Error(`cannot invert coordinates [${x}, ${y}]`);

    const [lng, lat] = pos;
    return { lng, lat, zoom: zoom_ };
  };
}
