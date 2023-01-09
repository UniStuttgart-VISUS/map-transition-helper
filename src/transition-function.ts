import { bisectLeft, cumsum } from 'd3-array';
import { geoInterpolate, geoMercator } from 'd3-geo';
import { interpolateNumber } from 'd3-interpolate';

import type { Coordinate, ViewPoint } from './points';

/**
 * An easing function takes a value `t` between 0 and 1, and returns a value
 * (ideally between) 0 and 1. Easing functions are used to define how a
 * transition should behave regarding speed.
 */
export type EasingFunction = (t: number) => number;

/**
 * A panning function is a function that returns a coordinate for each point in
 * time between the start time `t`=0 and the end time `t`=1.
 */
export type PanningFunction = (t: number) => Coordinate;

/**
 * A zoom function is a function that returns a zoom level for each point in
 * time between the start time `t`=0 and the end time `t`=1.
 */
export type ZoomFunction = (t: number) => number;

/**
 * A transition function returns an entire `ViewPoint` (`Coordinate` plus zoom
 * level) for each point in time between the start time `t`=0 and the end time
 * `t`=1.
 */
export type TransitionFunction = (t: number) => ViewPoint;

/**
 * Add an easing function to a panning function.
 *
 * @param pan     Initial panning function
 * @param ease    Easing function to apply
 * @returns       New panning function
 */
export function addPanningEase(pan: PanningFunction, ease: EasingFunction): PanningFunction {
  return (t: number) => pan(ease(t));
}

/**
 * Add an easing function to a zoom function.
 *
 * @param zoom    Initial zoom function
 * @param ease    Easing function to apply
 * @returns       New zoom function
 */
export function addZoomingEase(zoom: ZoomFunction, ease: EasingFunction): ZoomFunction {
  return (t: number) => zoom(ease(t));
}

/**
 * Add an easing function to a transition function.
 *
 * @param trans   Initial transition function
 * @param ease    Easing function to apply
 * @returns       New transition function
 */
export function addTransitionEase(
  trans: TransitionFunction,
  ease: EasingFunction,
): TransitionFunction {
  return (t: number) => trans(ease(t));
}

/**
 * Join a panning and a zoom function to create a transition function.
 *
 * @param pan     Panning function
 * @param zoom    Zoom function
 * @returns t     Transition function
 */
export function createTransitionFunction(
  pan: PanningFunction,
  zoom: ZoomFunction,
): TransitionFunction {
  return (t: number) => {
    return {
      ...pan(t),
      zoom: zoom(t),
    };
  };
}

/**
 * Join multiple transition functions together. Returns a single transition
 * function from `t`=0 to `t`=1. The portions of the new time domain the passed
 * transition functions occupy is given by the `weights` array. If that is
 * not passed, all functions will have equal weight.
 *
 * @param transs              Array of transition functions
 * @param weights (optional)  Array of time portion weights
 */
export function joinTransitions(
  transs: Array<TransitionFunction>,
  weights?: Array<number>,
): TransitionFunction {
  const functionWeights = weights ?? transs.map((_) => 1);
  if (transs.length === 0) throw new Error('must pass at least one transition function to join');
  if (transs.length !== functionWeights.length)
    throw new Error('length mismatch of transition functions and weights');

  const cumulativeWeights = cumsum(functionWeights);
  const totalWeight = cumulativeWeights[cumulativeWeights.length - 1];

  return function (t: number) {
    const extendedT = t * totalWeight;
    const idx = bisectLeft(cumulativeWeights, extendedT);
    const t0 = idx === 0 ? 0 : cumulativeWeights[idx - 1];
    const t1 = cumulativeWeights[idx];

    const innerT = (extendedT - t0) / (t1 - t0);
    return transs[idx](innerT);
  };
}

/// helpers

/**
 * Create a linear panning function between two coordinates. The transition
 * will be linear in the (Mercator) image space.
 *
 * @param p0    Start coordinate
 * @param p1    End coordinate
 * @return f    Panning function
 */
export function createPanning(p0: Coordinate, p1: Coordinate): PanningFunction {
  const { lat: lat0, lng: lng0 } = p0;
  const { lat: lat1, lng: lng1 } = p1;

  // check if going over the antimeridian would be quicker
  const dl = Math.abs(lng1 - lng0);
  const dx1 =
    dl <= 180
      ? 0 // need not cross antimeridian
      : lng1 > lng0
      ? -1 // naïve transition would be eastwards, westwards would be shorter
      : 1; // west- to eastwards

  const proj = geoMercator();

  const [x0, y0] = proj([lng0, lat0]) ?? [0, 0];
  const [x1, y1] = proj([lng1, lat1]) ?? [1, 1];

  // offset of second x coordinate in image space: {-1,0,1} * full image space
  // width, depending on the antimeridian check above
  const [xEast, _] = proj([180, 0]) ?? [1, 0];
  const [xWest, __] = proj([-180, 0]) ?? [-1, 0];
  const dx = dx1 * (xEast - xWest);

  const x = interpolateNumber(x0, x1 + dx);
  const y = interpolateNumber(y0, y1);

  return function (t: number): Coordinate {
    const [lng, lat] = proj.invert?.([x(t), y(t)]) ?? [0, 0];
    return { lat, lng };
  };
}

/**
 * Create a great circle panning function between two points. The resulting
 * panning will happen along the geodesic line between `p0` and `p1`.
 *
 * @param p0    Start coordinate
 * @param p1    End coordinate
 * @return f    Panning function
 */
export function createPanningGreatCircle(p0: Coordinate, p1: Coordinate): PanningFunction {
  const interpolator = geoInterpolate([p0.lng, p0.lat], [p1.lng, p1.lat]);
  return function (t: number): Coordinate {
    const [lng, lat] = interpolator(t);
    return { lng, lat };
  };
}

/**
 * Create a linear zoom function between two zoom levels.
 *
 * @param z0    Start zoom
 * @param z1    End zoom
 * @return f    Zoom function
 */
export function createZoom(z0: number, z1: number): ZoomFunction {
  return interpolateNumber(z0, z1);
}
