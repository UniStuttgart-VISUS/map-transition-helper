import { geoMercator } from 'd3-geo';
import { tile } from 'd3-tile';

import type { Coordinate, Point2D, ViewPoint } from './points';
import Tile from './tile';

/**
 * Frame class where all necessary information about a frame are stored.
 * Especially the required tiles for a frame are saved here.
 */
export default class Frame {
  // tiles within the frame
  readonly tiles: Array<Tile>;

  /**
   * Constructor only called by `calculateFrame` since the needed values are
   * highly specific.
   *
   * @param tiles             tile coordinates that are required for a frame,
   *                          as produced by d3-tile
   * @param offset            offset of the canvas center from the WebMercator
   *                          origin
   * @param translation       d3-tile translation, used to align the tile
   *                          quadtree to the projection
   * @param canvasSize        the size of the corresponding canvas (x=width,
   *                          y=height)
   * @param scale             scale value for the tiles in this frame. Only
   *                          needed for drawing the tiles into the canvas
   * @param zoom              the current zoom level
   */
  constructor(
    tiles: Array<[number, number, number]>,
    readonly offset: Point2D,
    readonly translation: Point2D,
    readonly canvasSize: Point2D,
    readonly scale: number,
    readonly zoom: number,
  ) {
    this.tiles = tiles.map((d) => new Tile(...d));
  }

  /**
   * Returns the viewpoint connected to specific pixel coordinates in the
   * frame.
   *
   * @param canvasCoordinate canvas coordinate
   * @returns viewpoint with zoom of the frame an to x,y corresponding lat lon
   */
  project(canvasCoordinate: Point2D): ViewPoint {
    const transCordX = canvasCoordinate.x - this.canvasSize.x / 2;
    const transCordY = canvasCoordinate.y - this.canvasSize.y / 2;

    const pixelCoordsX = this.offset.x + transCordX;
    const pixelCoordsY = this.offset.y + transCordY;

    let lng = (pixelCoordsX / (256 * Math.pow(2, this.zoom))) * 360 - 180;
    const lat =
      (Math.atan(
        Math.sinh(Math.PI - (pixelCoordsY / (256 * Math.pow(2, this.zoom))) * 2 * Math.PI),
      ) *
        180) /
      Math.PI;

    while (lng > 180) {
      lng -= 360;
    }
    while (lng < -180) {
      lng += 360;
    }

    return { lat, lng, zoom: this.zoom };
  }

  /**
   * Returns if a specific coordinate is visible in the frame.
   *
   * @param coord Coordinate
   * @returns true if point is visible and false else
   */
  public isCoordinateVisible(coord: Coordinate): boolean {
    const { x, y } = this.unproject(coord);

    return !(x < 0 || y < 0 || x >= this.canvasSize.x || y >= this.canvasSize.y);
  }

  /**
   * Returns canvas pixel coordinates of a given coordinate.
   *
   * @param coord Coordinate
   * @returns canvas pixel coordinates
   */
  public unproject({ lat, lng }: Coordinate | ViewPoint): Point2D {
    const maxX = Math.floor(256 * Math.pow(2, this.zoom));

    let x = Math.floor((lng + 180) * ((256 * Math.pow(2, this.zoom)) / 360));
    let y = Math.floor(
      (1 -
        Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) *
        Math.pow(2, this.zoom - 1) *
        256,
    );

    if (Math.abs(x - this.offset.x) <= maxX / 2) {
      // distance between point and frame center are a maximum of 180 degrees
      x = x - this.offset.x;
    } else if (x < this.offset.x) {
      // point is east of 180°E, frame center is west of 180°E
      x = x + (maxX - this.offset.x);
    } else if (x > this.offset.x) {
      // point is west of 180°E, frame center is east of 180°E
      x = -(maxX - x + this.offset.x);
    }

    y = y - this.offset.y;

    // translate to canvas center from upper corner
    return {
      x: x + this.canvasSize.x / 2,
      y: y + this.canvasSize.y / 2,
    };
  }
}

/**
 * Calculates the tile coordinates for a specific window, given a canvas
 * rendering context and a specific point. It is assumed that tiles have a
 * resolution of 256*256 as this is the standard case in practice.
 *
 * @param canvasSize size (x=width, y=height) of canvas
 * @param currentPoint ViewPoint that will be in the center of the frame
 * @returns Frame object that represents the viewpoint and windowsize
 */
export function calculateFrame(canvasSize: Point2D, currentPoint: ViewPoint): Frame {
  const projection = geoMercator()
    .scale((256 * Math.pow(2, currentPoint.zoom)) / (2 * Math.PI))
    .translate([0, 0]);

  const center: [number, number] = [currentPoint.lng, currentPoint.lat];
  const translate = projection(center)?.map((d) => -d) as [number, number];
  projection.translate(translate);

  const tiles = tile()
    .clampX(false)
    .clampY(false)
    .scale(projection.scale() * 2 * Math.PI)
    .translate(projection([0, 0]))
    .extent([
      [-canvasSize.x / 2, -canvasSize.y / 2],
      [canvasSize.x / 2, canvasSize.y / 2],
    ])();

  const xCenter = Math.floor(
    (currentPoint.lng + 180) * ((256 * Math.pow(2, currentPoint.zoom)) / 360),
  );

  const yCenter = Math.floor(
    (1 -
      Math.log(
        Math.tan((currentPoint.lat * Math.PI) / 180) +
          1 / Math.cos((currentPoint.lat * Math.PI) / 180),
      ) /
        Math.PI) *
      Math.pow(2, currentPoint.zoom - 1) *
      256,
  );

  return new Frame(
    tiles,
    { x: xCenter, y: yCenter },
    { x: tiles.translate[0], y: tiles.translate[1] },
    canvasSize,
    tiles.scale,
    currentPoint.zoom,
  );
}
