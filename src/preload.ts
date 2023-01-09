import type Frame from './frame';
import { calculateFrame } from './frame';
import type { Point2D } from './points';
import TileMap from './tile-map';
import Transition from './transition';
import type { TransitionFunction } from './transition-function';

/**
 * Preloads a transition and returns a transition object.
 *
 * @param transitionFunction  Transition function which describes the position
 *                            of the viewing window and its zoom for every
 *                            point during the transition.
 * @param canvasSize    size of the canvas
 * @param numberOfFrames  number of frames of the transition (directly
 *                        determines the length of the animation)
 * @param tileMap (optional)  If set by the user, this tilemap object is used
 *                            to store the bitmaps of the needed Mercator
 *                            tiles. Can be useful if more than one transition
 *                            should be stored in the tilemap. This can lead to
 *                            less memory consumption since a tile may
 *                            participate in more than one transition.
 *
 * @returns transition object for the given parameters.
 */
export default async function preloadTransition(
  transitionFunction: TransitionFunction,
  canvasSize: Point2D,
  numberOfFrames: number,
  tileMap: TileMap = new TileMap(),
): Promise<Transition> {
  const addPromises: Array<Promise<void>> = [];
  const frameArray: Array<Frame> = [];

  for (let i = 0; i <= numberOfFrames; i++) {
    const t = i / numberOfFrames;

    const vp = transitionFunction(t);
    const currentFrame: Frame = calculateFrame(canvasSize, vp);
    frameArray.push(currentFrame);

    for (const t of currentFrame.tiles) {
      addPromises.push(tileMap.addToTileMap(t));
    }
  }

  await Promise.all(addPromises);
  return new Transition(frameArray, tileMap);
}
