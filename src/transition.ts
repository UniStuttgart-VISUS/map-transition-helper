import type Frame from './frame';
import type TileMap from './tile-map';

export enum TransitionState {
  UNINITIALIZED = 'uninitialized',
  PAUSED = 'paused',
  RUNNING = 'running',
  FINISHED = 'finished',
}

/**
 * A class describing a transition, containing a tile map where Bitmaps of all needed Tiles are saved. We also save every Frame as an Object.
 */
export default class Transition extends EventTarget {
  private _reverseDirection: boolean; // If set to true, the transitions direction will be reversed

  private rafId: ReturnType<typeof window.requestAnimationFrame>;
  private _transitionState: TransitionState = TransitionState.UNINITIALIZED;
  private _currentFrameIndex = 0;
  private context?: CanvasRenderingContext2D;

  /**
   * Constructor only used by preloadTransition/preloadGreatCircleTransition
   *
   * @param frameArray Array of Frames needed for the transition
   * @param tileMap tileMap in which the bitmaps of the needed tiles are saved
   */
  constructor(private _frameArray: Array<Frame>, private _tileMap: TileMap) {
    super();
  }

  get frameArray(): Array<Frame> {
    return this._frameArray;
  }

  get length(): number {
    return this._frameArray.length;
  }

  /**
   * Returns the frame of a given framenumber
   * @param frameNumber given framenumber (0=firstFrame in Transition)
   * @returns
   */
  public getFrame(frameNumber: number): Frame {
    return this._frameArray[frameNumber];
  }

  get tileMap(): TileMap {
    return this._tileMap;
  }

  set tileMap(tileMap: TileMap) {
    this._tileMap = tileMap;
  }

  get currentFrame() {
    return this._frameArray[this._currentFrameIndex];
  }

  get currentFrameIndex(): number {
    return this._currentFrameIndex;
  }

  set currentFrameIndex(idx: number) {
    if (idx < 0 || idx >= this._frameArray.length) throw new Error('index out of bounds');

    this._currentFrameIndex = idx;
    this.dispatchEvent(new CustomEvent('frame'));

    if (this._transitionState !== TransitionState.RUNNING)
      this.rafId = requestAnimationFrame((_) => this.renderFrame(this.context));
  }

  get state(): TransitionState {
    return this._transitionState;
  }

  get reversed(): boolean {
    return this._reverseDirection;
  }

  set reversed(rev: boolean) {
    this._reverseDirection = rev;
  }

  public initialize(context: CanvasRenderingContext2D): void {
    this.context = context;
    context.setTransform(1, 0, 0, 1, context.canvas.width / 2, context.canvas.height / 2);
    this._transitionState = TransitionState.PAUSED;
    this._currentFrameIndex = this._reverseDirection ? this._frameArray.length - 1 : 0;
    this.dispatchEvent(new CustomEvent('frame'));

    this.renderFrame(context);
  }

  public play(): void {
    if (this._currentFrameIndex === (this._reverseDirection ? 0 : this._frameArray.length - 1)) {
      console.warn('tried to play, but already at end of transition');

      this.rafId = requestAnimationFrame((_) => {
        this.renderFrame(this.context);
        this._transitionState = TransitionState.FINISHED;
        this.dispatchEvent(new CustomEvent('finish'));
        this.dispatchEvent(new CustomEvent('pause'));
      });
    } else {
      this.rafId = requestAnimationFrame((_) => {
        this.renderFrame(this.context);
        this.rafId = requestAnimationFrame(this.doFrame.bind(this));
      });
    }
    this._transitionState = TransitionState.RUNNING;

    this.dispatchEvent(new CustomEvent('play'));
  }

  public pause(): void {
    cancelAnimationFrame(this.rafId);
    this._transitionState = TransitionState.PAUSED;

    this.dispatchEvent(new CustomEvent('pause'));
  }

  public cancel(): void {
    cancelAnimationFrame(this.rafId);
    this._transitionState = TransitionState.PAUSED;
    this._currentFrameIndex = this._reverseDirection ? this._frameArray.length - 1 : 0;
    this.rafId = requestAnimationFrame(this.doFrame.bind(this));

    this.dispatchEvent(new CustomEvent('cancel'));
    this.dispatchEvent(new CustomEvent('pause'));
  }

  private doFrame() {
    this._currentFrameIndex += this._reverseDirection ? -1 : 1;
    this.dispatchEvent(new CustomEvent('frame'));

    this.renderFrame(this.context);

    if (
      (this._currentFrameIndex >= this._frameArray.length - 1 && !this._reverseDirection) ||
      (this._currentFrameIndex <= 0 && this._reverseDirection)
    ) {
      this._transitionState = TransitionState.FINISHED;
      this.dispatchEvent(new CustomEvent('finish'));
      this.dispatchEvent(new CustomEvent('pause'));
    }

    if (this._transitionState === TransitionState.RUNNING) {
      this.rafId = requestAnimationFrame(this.doFrame.bind(this));
    }
  }

  /**
   * Renders a map frame into a canvas.
   *
   * @param context  context of the canvas on which the map should be displayed
   * @param frame frame object that specifies which tiles are needed for the frame
   * @param tileMap tilemap object containing bitmaps of tiles
   */
  private renderCanvas(
    context: CanvasRenderingContext2D | undefined,
    frame: Frame,
    tileMap: TileMap,
  ): void {
    if (!context) return;

    context.save();
    context.translate(
      Math.round(frame.translation.x * frame.scale),
      Math.round(frame.translation.y * frame.scale),
    );

    for (const t of frame.tiles) {
      const x = t.x * frame.scale;
      const y = t.y * frame.scale;
      const size = frame.scale;

      const image = tileMap.getTileImage(t);
      if (image !== undefined) context.drawImage(image, x, y, size, size);
    }
    context.restore();

    this.dispatchEvent(new CustomEvent('render'));
  }

  /**
   * Render the current frame (or a given one) to a canvas.
   *
   * @param context   Canvas 2D context to render to
   * @param index     optional: index of frame to draw. Will use current frame
   *                  if not passed.
   */
  private renderFrame(context: CanvasRenderingContext2D | undefined, index?: number): void {
    if (context === undefined) return;

    const frameIndex = index ?? this.currentFrameIndex;
    if (frameIndex >= this.length)
      throw new Error(`frame index too large: ${frameIndex} ${this.length}`);
    return this.renderCanvas(context, this.getFrame(frameIndex), this.tileMap);
  }
}
