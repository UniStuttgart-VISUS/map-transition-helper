This library provides functionalities to define and compose animated transitions on maps, which are then rendered in a web page.
The WebMercator map tiles required to show the transition are pre-loaded to ensure a smooth animation.
**npm** package link: [https://www.npmjs.com/package/map-transition-helper](https://www.npmjs.com/package/map-transition-helper).


## Table of Contents
- [Installation](#installation)
- [API Description](#api-description)
    - [Point Types](#point-types)
    - [Transition Functions](#transition-functions)
        - [Types](#transition-functions--types)
        - [Factory Functions](#transition-functions--factories)
        - [Composition Functions](#transition-functions--compositions)
        - [Predefined Transition Functions](#transition-functions--predefined)
    - [`preloadTransition` Function](#preloadtransition-function)
    - [Utility Functions](#utility-functions)
    - [Class `TileMap`](#class-tilemap)
        - [`constructor`](#class-tilemap--constructor)
        - [Properties](#class-tilemap--properties)
        - [Methods](#class-tilemap--methods)
        - [Events](#class-tilemap--events)
    - [Class `Tile`](#class-tile)
        - [`constructor`](#class-tile--constructor)
        - [Properties](#class-tile--properties)
        - [`clone(): Tile`](#class-tile--clone)
    - [Class `Frame`](#class-frame)
        - [`constructor`](#class-frame--constructor)
        - [Properties](#class-frame--properties)
        - [Methods](#class-frame--methods)
    - [Class `Transition`](#class-transition)
        - [`constructor`](#class-transition--constructor)
        - [Properties](#class-transition--properties)
        - [Methods](#class-transition--methods)
        - [Events](#class-transition--events)
    - [Enum `TransitionState`](#enum-transitionstate)
- [Usage Examples](#usage-examples)
- [Attribution](#attribution)


## Installation

The library is built using Rollup.
A demo with some event tests and transitions is available in [`demo/`](./demo).
The demo requires the library to be compiled.
To do so:

``` bash
$ npm install
$ npx rollup -c
```

To use the library in another project, either build it and use the generated ES module[^esm] (`lib/map-transition-helper.esm.js`) or the CommonJS build (`lib/map-transition-helper.umd.js`, global name `MapTransitionHelper`) directly.
Alternatively, it can be installed as an npm package, either from the command line:

``` bash
$ npm install map-transition-helper@0.4.3
```

or by adding the following to the `dependencies` property in the `package.json` of your project (with the appropriate version):

``` json
{
    ...
    "dependencies": {
        "map-transition-helper": "0.4.3",
        ...
    },
    ...
}
```

[^esm]: The ES module build expects some external dependencies to exist, namely the D3.js modules it uses internally.
Unfortunately, I have not yet gotten the ES build to load in the browser without it complaining about the external imports.
However, it can be used with a build tool like WebPack or Rollup.


## API Description

### Point Types

Different types of points exist throughout the API:
Two- and three-dimensional cartesian points, two-dimensional geographical coordinates, and three-dimensional geographical view points that include a zoom level.

``` typescript
interface Point2D {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface ViewPoint {
  lat: number;
  lng: number;
  zoom: number;
}
```


### <a id="transition-functions"></a>Transition Functions

Transitions can be defined by a function that, for each point in time, returns a [`ViewPoint`](#class-viewpoint); that is, a tuple of latitude, longitude, and zoom level.
Transitions can be chained, and the time (in [0,1]) they receive can be pre-affected by an easing function.

#### <a id="transition-functions--types"></a>Types

##### `EasingFunction`

``` typescript
type EasingFunction = (t: number) => number;
```

An easing function takes a value `t` between 0 and 1, and returns a value (ideally between) 0 and 1.
Easing functions are used to define how a transition should behave regarding speed.

##### `PanningFunction`

``` typescript
type PanningFunction = (t: number) => Coordinate;
```

A panning function is a function that returns a coordinate for each point in time between the start time `t`=0 and the end time `t`=1.

##### `ZoomFunction`

``` typescript
type ZoomFunction = (t: number) => number;
```

A zoom function is a function that returns a zoom level for each point in time between the start time `t`=0 and the end time `t`=1.

##### `TransitionFunction`

``` typescript
type TransitionFunction = (t: number) => ViewPoint;
```

A transition function returns an entire `ViewPoint` (`Coordinate` plus zoom level) for each point in time between the start time `t`=0 and the end time `t`=1.


#### <a id="transition-functions--factories"></a>Factory Functions

The factory functions can be used to create basic building blocks for more complex transition functions.
Very custom functions can be written instead, of course.


##### `createPanning(p0: Coordinate, p1: Coordinate): PanningFunction`

Create a linear panning function between two coordinates.
The transition will be linear in the (Mercator) image space.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `Coordinate` | Start coordinate |
| `p1` | `Coordinate` | End coordinate |


##### `createPanningGreatCircle(p0: Coordinate, p1: Coordinate): PanningFunction`

Create a great circle panning function between two points.
The resulting panning will happen along the geodesic line between `p0` and `p1`.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `Coordinate` | Start coordinate |
| `p1` | `Coordinate` | End coordinate |


##### `createZoom(z0: number, z1: number): ZoomFunction`

Create a linear zoom function between two zoom levels.
This is just a thin wrapper around [`d3.interpolateNumber`](https://github.com/d3/d3-interpolate#interpolateNumber).

| Parameter | Type | Description |
| --- | --- | --- |
| `z0` | `number` | Start zoom |
| `z1` | `number` | End zoom |


#### <a id="transition-functions--compositions"></a>Composition Functions

Basic building blocks, but also whole transition functions, can be composed for more complex behavior.
This can happen multiple times.


##### `addPanningEase(pan: PanningFunction, ease: EasingFunction): PanningFunction`

Add an easing function to a panning function.
The result will be `t -> pan(ease(t))`.

| Parameter | Type | Description |
| --- | --- | --- |
| `pan` | `PanningFunction` | Initial panning function |
| `ease` | `EasingFunction` | Easing function to apply |


##### `addZoomingEase(zoom: ZoomFunction, ease: EasingFunction): ZoomFunction`

Add an easing function to a zoom function.
The result will be `t -> zoom(ease(t))`.

| Parameter | Type | Description |
| --- | --- | --- |
| `zoom` | `ZoomFunction` | Initial zoom function |
| `ease` | `EasingFunction` | Easing function to apply |


##### `addTransitionEase(trans: TransitionFunction, ease: EasingFunction): TransitionFunction`

Add an easing function to a transition function.
The result will be `t -> trans(ease(t))`.

| Parameter | Type | Description |
| --- | --- | --- |
| `trans` | `TransitionFunction` | Initial transition function |
| `ease` | `EasingFunction` | Easing function to apply |


##### `createTransitionFunction(pan: PanningFunction, zoom: ZoomFunction): TransitionFunction`

Join a panning and a zoom function to create a transition function.

| Parameter | Type | Description |
| --- | --- | --- |
| `pan` | `PanningFunction` | Panning function |
| `zoom` | `ZoomFunction` | Zoom function |


##### <a id="function-jointransitions"></a>`joinTransitions(transs: Array<TransitionFunction>, weights?: Array<number>): TransitionFunction`

Join multiple transition functions together.
Returns a single transition function from `t`=0 to `t`=1.
The portions of the new time domain the passed transition functions occupy is given by the `weights` array.
If that is not passed, all functions will have equal weight.

| Parameter | Type | Description |
| --- | --- | --- |
| `transs` | `Array<TransitionFunction>` | Array of transition functions |
| `weights` | `Array<number>` (optional) | Array of time portion weights |


#### <a id="transition-functions--predefined"></a>Predefined Transition Functions

Some basic transition functions come predefined.

##### `createLinearPanTransition(p0: ViewPoint, p1: ViewPoint): TransitionFunction`

Create a linear panning transition without zooming.
The zoom level of the first view point will be used throughout.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `ViewPoint` | Start point |
| `p1` | `ViewPoint` | End point |


##### `createLinearZoomAndPanTransition(p0: ViewPoint, p1: ViewPoint): TransitionFunction`

Create a linear pan and zoom.
Can also be used to just zoom.

**NOTE:** In some cases, this is probably not what you want:
Zooming is linear in the zoom level, but panning speed then needs to scale with the current
zoom level so that it is perceived as linear.
For zoom+pan transitions, use [`createPerceivedLinearZoomAndPanTransition`](#createperceivedlinearzptransition) instead.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `ViewPoint` | Start point |
| `p1` | `ViewPoint` | End point |


##### <a id="createperceivedlinearzptransition"></a>`createPerceivedLinearZoomAndPanTransition(p0: ViewPoint, p1: ViewPoint): TransitionFunction`

Create a pan and zoom transition that is perceived as being linear.
The panning will depend on the zoom level.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `ViewPoint` | Start point |
| `p1` | `ViewPoint` | End point |


##### `createBoxTransition(p0: ViewPoint, p1: ViewPoint, canvasSize: Point2D, minZoom?: number): TransitionFunction`

Create a box transition: zoom out from `p0` until `p1` is visible.
Then pan to `p1`.
Then zoom into `p1`.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `ViewPoint` | Start point |
| `p1` | `ViewPoint` | End point |
| `canvasSize` | `Point2D` | Size of the canvas the transition will run on |
| `minZoom` | `number` (optional) | Zoom level for panning phase. If not given, will be calculated to fit. |


##### `createTriangularTransition(p0: ViewPoint, p1: ViewPoint, canvasSize: Point2D, minZoom?: number): TransitionFunction`

Create a (perceived) triangular transition:
Zoom out and pan from `p0` to the midpoint between `p0` and `p1` in the image space, at which time both `p0` and `p1` will be visible.
Then, continue panning and zooming in again until centered on `p1`.

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | `ViewPoint` | Start point |
| `p1` | `ViewPoint` | End point |
| `canvasSize` | `Point2D` | Size of the canvas the transition will run on |
| `minZoom` | `number` (optional) | Zoom level for panning phase. If not given, will be calculated to fit. |


### `preloadTransition` Function

``` typescript
async function preloadTransition(
  transitionFunction: TransitionFunction,
  canvasSize: Point2D,
  numberOfFrames: number,
  tileMap?: TileMap
): Promise<Transition>
```

This is the central functionality of the library.
It preloads all map tiles and pre-calculates all [`Frame`s](#class-frame) needed for a transition, and returns a [`Transition`](#class-transition) object asynchronously.

| Parameter | Type | Description |
| --- | --- | --- |
| `transitionFunction` | `TransitionFunction` | Transition function which describes the position of the viewing window and its zoom for every point during the transition. |
| `canvasSize` | `Point2D` | size of the canvas. |
| `numberOfFrames` | `number` | number of frames of the transition (directly determines the length of the animation). On most devices, 60 frames are displayed per second. |
| `tileMap` | `TileMap`  (optional) | If set by the user, this tilemap object is used to store the bitmaps of the needed Mercator tiles. Can be useful if more than one transition should be stored in the tilemap. This can lead to less memory consumption since a tile may participate in more than one transition. |


### Utility Functions

#### `calcMinZoomCenteredOn(center: Coordinate, outer: Coordinate, canvasSize: Point2D, margin?: number): number`

Calculate the minimal zoom level, centered on `center` on a canvas of size `canvasSize`, such that `outer` is visible `margin` pixels from the canvas edge.
Returns the minimal (strictly: maximal) zoom level that satisfies the condition.

| Parameter | Type | Description |
| --- | --- | --- |
| `center` | `Coordinate` | Center of the map |
| `outer` | `Coordinate` | Other point that should be visible |
| `canvasSize` | `Point2D` | Size of the canvas |
| `margin` | `number` (optional) | Distance of `outer` from the edge in pixels, default 20 |


#### `calcZoomFitPoints(coordinates: Array<Coordinate>, canvasSize: Point2D, margin: number = fitMargin,): number`

Calculate the minimal (maximal) zoom level such that all `coordinates` are still visible in a map with size `canvasSize`, with all points at least `margin` pixels from the edge of the canvas.

| Parameter | Type | Description |
| --- | --- | --- |
| `coordinates` | `Array<Coordinate>` | Array of coordinates that should be visible |
| `canvasSize` | `Point2D` | Size of canvas |
| `margin` | `number` (optional) | Minimum distance of coordinates from the edge of the canvas in pixels, default 20 |


#### `calculateFrame(canvasSize: Point2D, currentPoint: ViewPoint): Frame`

Calculate the [`Frame`](#class-frame) object that describes a particular [`ViewPoint`](#class-viewpoint) for a given canvas size.


### Class `TileMap`

An object of this class preloads and stores the map tiles required for transitions.
`TileMap` objects can be reused for multiple transitions.
`TileMap` extends `EventTarget` and fires events when tiles are loaded, fail to load, and loading is complete.


#### <a id="class-tilemap--constructor"></a>`constructor`

``` typescript
constructor(
    readonly _tileServerUrl: string = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    readonly _maxZoom: number = 19,
)
```

#### <a id="class-tilemap--properties"></a>Properties

##### `numTiles: number`

The number of tiles stored in the tile map.


#### <a id="class-tilemap--methods"></a>Methods

##### `hasTile(tile: Tile): boolean`

Returns `true` if the tile described by `tile` is loaded.

##### `getProgress(): { loading: number, finished: number, failed: number, total: number }`

Get the current loading progress, for example for a progress bar.
`total` is the sum of `loading`, failed, and `finished`.

##### `async addToTileMap(tile: Tile): Promise<void>`

Preload `tile`, if it has not been loaded yet.

##### `getTileImage(tile: Tile): ImageBitmap`

Get the image data for the passed tile coordinates.
If the coordinates are outside the world boundaries, returns a white tile instead.

##### `async fetchFailedTiles(): Promise<void>`

Try again to load all tiles that failed loading.

#### <a id="class-tilemap--events"></a>Events

##### `tileadded`

Fired each time a new (unique) tile is added.
The `CustomEvent`'s `detail` property contains the `Tile` instance.

##### `tileloaded`

Fired each time a tile is successfully loaded.
The `CustomEvent`'s `detail` property contains the `Tile` instance.

##### `tilefailed`

Fired each time a tile load fails.
The `CustomEvent`'s `detail` property contains the `Tile` instance.

##### `loaded`

Fired each time all queued tiles are loaded.


### Class `Tile`

Class which represents a map tile with x, y an zoom value.

#### <a id="class-tile--constructor"></a>`constructor`

``` typescript
constructor(
  readonly x: number,
  readonly y: number,
  readonly zoom: number
)
```

Does not usually need to be called directly.
This is handled by `preloadTransition`.

#### <a id="class-tile--properties"></a>Properties

The properties are the same as the parameters of the constructor.

#### <a id="class-tile--clone"></a>`clone(): Tile`

Create a new `Tile` instance with the same `x`, `y` and `zoom` values.


### Class `Frame`

Frame class where all necessary information about a frame are stored.
Especially the required tiles for a frame are saved here.

#### <a id="class-frame--constructor"></a>`constructor`

``` typescript
constructor(
  tiles: Array<[number, number, number]>,
  readonly offset: Point2D,
  readonly translation: Point2D,
  readonly canvasSize: Point2D,
  readonly scale: number,
  readonly zoom: number
)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `tiles` | `Array<[number, number, number]>` | tile coordinates that are required for a frame, as produced by d3-tile |
| `offset` | `Point2D` | offset of the canvas center from the WebMercator origin |
| `translation` | `Point2D` | d3-tile translation, used to align the tile quadtree to the projection |
| `canvasSize` | `Point2D` | the size of the corresponding canvas (x=width, y=height) |
| `scale` | `number` | scale value for the tiles in this frame. Only needed for drawing the tiles into the canvas |
| `zoom` | `number` | the current zoom level |

Does not usually need to be called directly.
This is handled by `preloadTransition`.

#### <a id="class-frame--properties"></a>Properties

The properties are the same as the parameters of the constructor.

#### <a id="class-frame--methods"></a>Methods

##### <a id="class-frame--project"></a>`project(coord: Coordinate | ViewPoint): Point2D`

Calculate the pixel coordinates of real-world coordinates.
This is the inverse of [`unproject`](#class-frame--unproject).

##### <a id="class-frame--unproject"></a>`unproject(coord: Point2D): ViewPoint`

Calculate the latitude, longitude and zoom level shown at the pixel coordinate `coord`.
This is the inverse of [`project`](#class-frame--project).

##### `isCoordinateVisible(c: Coordinate): boolean`

Checks if the coordinate is within the drawable area of the canvas in the frame.

##### `borderPosition(c: Coordinate | ViewPoint, offset: number = 0): { x, y, border, direction }`

Calculate the position `c` at the border of the frame that is in the direction of a coordinate.
This can be used for positions that are visible in the current frame as well, but should not be.
An optional parameter `offset` specifies the perpendicular distance of the point to the border it should lie on, with positive values going into the frame.
This can be used to place objects of known size at the frame border in different alignments.
Returns an object with the x and y coordinates relative to the frame, the border (top, left, bottom, or right) at which the shortest path to the coordinate leaves the frame, and the direction (in radians) towards the point from the center of the frame.



### Class `Transition`

Main class to interact with.
This extends `EventTarget`, so `addEventListener` is supported.


#### <a id="class-transition--constructor"></a>`constructor`

``` typescript
constructor(frames: Frame[], tileMap: TileMap)
```

Takes two parameters, an array of [`Frame`s](#class-frame) and a [`TileMap`](#class-tilemap).
The constructor need never be called directly.
Use the [`preloadTransition`](#preloadtransition-function) function instead.

#### <a id="class-transition--properties"></a>Properties

##### `frameArray: Frame[]`

Property (read-only) containing all [`Frame`s](#class-frame).

##### `length: number`

Property (read-only) containing the number of [`Frame`s](#class-frame) in the transition.

##### `tileMap: TileMap`

Read-write property containing the transition's [`TileMap`](#class-tilemap).

##### `currentFrame: Frame`

Read-only property containing the current [`Frame`](#class-frame).

##### `currentFrameIndex: number`

Read-write property containing the current [`Frame`](#class-frame)'s index.

##### <a id="transition--state"></a>`state: TransitionState`

Read-only property containing the state of the transition (`uninitialized`, `paused`, `running`, `finished`).

##### `reversed: boolean`

Read-write property stating the direction of the transition.
If `reversed === true`, then the transition will run from the last frame to the first.

#### <a id="class-transition--methods"></a>Methods

##### `getFrame(index: number): Frame`

Get the [`Frame`](#class-frame) at `index`.

##### `initialize(context: CanvasRenderingContext2D): void`

Set up the transition for the `canvas` rendering context.
This must be called before the transition so that the transition can draw to the canvas.
This will also render the first (or [last](#reversed-boolean)) frame to the canvas.

Will fire `frame` and `render` events.

##### `play(): void`

Play the transition from the current frame.
This will draw a new frame each browser frame.

Will fire a `play` event immediately.
Will fire `frame` and `render` events each frame until the last frame is rendered.
Then, a `finished` and a `pause` event are fired as well.

##### `pause(): void`

Stop the animation immediately.

Will fire a `pause` event.

##### `pause(): void`

Stop the animation immediately, reset to the first (or [last](#reversed-boolean)) frame, and render that to the canvas.

Will fire `cancel`, `pause`, `frame` and `render` events.
The `cancel` event is fired immediately, but the first (or last) frame is only rendered in the next browser frame, and the other events are fired then.

#### <a id="class-transition--events"></a>Events

##### `frame`

Fired when a new frame will be rendered;
i.e., when the transformations on the `canvas` might have changed.
This is the event to listen for to determine if overlays should be re-rendered.

##### `render`

Fired when the frame is actually rendered.

##### `play`

Fired when transition starts or resumes.

##### `pause`

Fired when transition pauses.

##### `cancel`

Fired when transition is cancelled.

##### `finish`

Fired when transition completes.


### Enum `TransitionState`

The state of a transition, as stored in [`Transition.state`](#transition--state).

``` typescript
enum TransitionState {
  UNINITIALIZED = 'uninitialized',
  PAUSED = 'paused',
  RUNNING = 'running',
  FINISHED = 'finished',
};
```


## Usage Examples

Here are some simple examples of how to use the API.
These expect to be run from an HTML file with a `<canvas>` element (ideally of larger size, for example 800x600) already added.
For more examples, see the [demo](./demo/main.js).

### Simple Linear Transition

For a very simple, linear transition, use the [predefined transition functions](#transition-functions--predefined) to create a transition from Stuttgart to Esslingen on zoom level 12:

``` javascript
import '../lib/map-transition-helper.umd.js';
const { createLinearPanTransition, preloadTransition } = MapTransitionHelper;

const canvas = document.querySelector('canvas');
const transitionFunction = createLinearPanTransition(
  { lat: 48.7734, lng: 9.1829, zoom: 12 }, // Stuttgart
  { lat: 48.7392, lng: 9.3049, zoom: 12 } // Esslingen
);
const transition = await preloadTransition(
  transitionFunction,
  { x: canvas.width, y: canvas.height },
  120 // number of frames, equals 2s
);

// initialize transition on canvas
transition.initialize(canvas.getContext('2d'));

// notify me when transition is finished
transition.addEventListener('finish', () => console.log('transition finished'));

// run
transition.play();
```

### Add Custom Easing to a Linear Transition

For adding easing, the functions provided by [d3-ease](https://github.com/d3/d3-ease) might be useful.
Here, we define a custom function that transitions slowly in the first and last segment, and pauses in the middle:

``` javascript
import { easeCubic } from 'https://cdn.skypack.dev/d3-ease@3';
import '../lib/map-transition-helper.umd.js';  // provides global MapTransitionHelper
const {
  addTransitionEase,
  createLinearPanTransition,
  preloadTransition,
} = MapTransitionHelper;


const canvas = document.querySelector('canvas');
const linearTransitionFunction = createLinearPanTransition(
  { lat: 48.7734, lng: 9.1829, zoom: 12 }, // Stuttgart
  { lat: 48.7392, lng: 9.3049, zoom: 12 } // Esslingen
);

// easing function
function customEase(t) {
  if (t < 0.4) return 0.5 * easeCubic(2.5 * t);
  if (t < 0.6) return 0.5;
  return 0.5 + 0.5 * easeCubic(2.5 * (t - 0.5));
}

// apply to linear transition
const transitionFunction = addTransitionEase(linearTransitionFunction, customEase);

const transition = await preloadTransition(
  transitionFunction,
  { x: canvas.width, y: canvas.height },
  180 // number of frames, equals 3s
);

transition.initialize(canvas.getContext('2d'));
transition.play();
```

### Compose a Complex Transition

The [`joinTransitions`](#function-jointransitions) function can be used to compose multiple transitions to one complex transition.
The resulting transition function will again run from `t=0` to `t=1`.

``` javascript
import '../lib/map-transition-helper.umd.js';  // provides global MapTransitionHelper
const {
  calcMinZoomCenteredOn,
  createBoxTransition,
  createLinearPanTransition,
  createLinearZoomAndPanTransition,
  createPerceivedLinearZoomAndPanTransition,
  joinTransitions,
  preloadTransition,
  TileMap,
} = MapTransitionHelper;

const canvas = document.querySelector('canvas');

// use different map tiles
const tileMap = new TileMap('https://tile.openstreetmap.org/{z}/{x}/{y}.png');

const stuttgart = { lat: 48.7734, lng: 9.1829 };
const munich = { lat: 48.1391, lng: 11.569 };
const milano = { lat: 45.4553, lng: 9.2064 };

// part 1: zoom out of Stuttgart until Munich is visible
const stuttgartMunichZoom = calcMinZoomCenteredOn(
  stuttgart,
  munich,
  { x: canvas.width, y: canvas.height },
  50
);
const zoomOut = createLinearZoomAndPanTransition(
  { ...stuttgart, zoom: 15 },
  { ...stuttgart, zoom: stuttgartMunichZoom }
);

// part 2: zoom into Munich while panning to it
const panAndZoomToMunich = createPerceivedLinearZoomAndPanTransition(
  { ...stuttgart, zoom: stuttgartMunichZoom },
  { ...munich, zoom: 12 }
);

// part 3: pause in Munich
const pause = createLinearPanTransition({ ...munich, zoom: 12 }, { ...munich, zoom: 12 });

// part 4: box transition to Milano with fixed minZoom = 4
const boxToMilano = createBoxTransition(
  { ...munich, zoom: 12 },
  { ...milano, zoom: 14 },
  { x: canvas.width, y: canvas.height },
  4
);

// join:
//  - 20% of time zooming out of Stuttgart,
//  - 35% zooming into Munich,
//  - pause 10%,
//  - 35% box transition to Milano
const transitionFunction = joinTransitions(
  [zoomOut, panAndZoomToMunich, pause, boxToMilano],
  [20, 35, 10, 35]
);

const transition = await preloadTransition(
  transitionFunction,
  { x: canvas.width, y: canvas.height },
  600, // number of frames, equals 10s
  tileMap
);

transition.initialize(canvas.getContext('2d'));
transition.play();
```


### Custom Panning with an SVG Overlay

This example demonstrates custom panning (here an Archimedean spiral defined in the geospatial domain) and zoom functions.
It also demonstrates the API for updating other DOM when the `ViewPoint` of the canvas changes, and calculating between screen and geographical coordinate systems.


``` javascript
import '../lib/map-transition-helper.umd.js';  // provides global MapTransitionHelper
const {
  createTransitionFunction,
  preloadTransition,
  TileMap,
} = MapTransitionHelper;
const canvas = document.querySelector('canvas');

// create SVG overlay
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const { top, left, width, height } = canvas.getBoundingClientRect();
svg.style.position = 'absolute';
svg.style.top = `${top}px`;
svg.style.left = `${left}px`;
svg.setAttribute('width', width);
svg.setAttribute('height', height);
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
document.body.append(svg);

// spiral inwards towards Stuttgart slowly, going around four times
const stuttgart = { lat: 48.7734, lng: 9.1829, zoom: 12 };
function panningCircle(t) {
  const theta = 4 * 2 * Math.PI * t;
  const r = 0.2 * (1 - t);
  const lat = stuttgart.lat + r * Math.sin(theta);
  const lng = stuttgart.lng + r * Math.cos(theta);
  return { lat, lng };
}

// zoom in slowly
const zoom = t => 10 + 2 * t;

const tileMap = new TileMap('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
const transitionFunction = createTransitionFunction(panningCircle, zoom);
const transition = await preloadTransition(
  transitionFunction,
  { x: canvas.width, y: canvas.height },
  900,
  tileMap
);

// each frame, update the overlay SVG by drawing a dot where Stuttgart is
transition.addEventListener('frame', () => {
  const frame = transition.currentFrame;
  const { x, y } = frame.project(stuttgart);
  svg.innerHTML = `
    <circle r="5"
            cx="${x}"
            cy="${y}"
            stroke="none"
            fill="rebeccapurple" />
  `;
});

transition.initialize(canvas.getContext('2d'));  // fires first 'frame' event
transition.play();  // fires 'frame' event each frame
```


## Attribution

This library was initially designed and developed by Leon Gutknecht, Benjamin Hahn, Alexander Riedlinger, Ingo Schwendinger, and Joel Waimer.
This work was done within the scope of a study project (Bachelorforschungsprojekt) at the *Institute for Visualization and Interactive Systems* at the University of Stuttgart, under the supervision of Max Franke and Samuel Beck, and examined by Prof. Dr. Thomas Ertl.
The library has since been further developed and maintained by Max Franke.
