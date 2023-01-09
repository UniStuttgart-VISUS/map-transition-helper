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
