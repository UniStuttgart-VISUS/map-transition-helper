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
  unproject(canvasCoordinate: Point2D): ViewPoint {
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
  isCoordinateVisible(coord: Coordinate): boolean {
    const { x, y } = this.project(coord);

    return !(x < 0 || y < 0 || x >= this.canvasSize.x || y >= this.canvasSize.y);
  }

  /**
   * Returns canvas pixel coordinates of a given coordinate.
   *
   * @param coord Coordinate
   * @returns canvas pixel coordinates
   */
  project({ lat, lng }: Coordinate | ViewPoint): Point2D {
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

  /**
   * Calculate the position at the border of the frame that is in the
   * direction of a coordinate. This can be used for positions that are
   * visible in the current frame as well, but should not be.
   *
   * Returns an object with the x and y coordinates relative to the frame, the
   * border (top, left, bottom, or right) at which the shortest path to the
   * coordinate leaves the frame, and the direction (in radians) towards the
   * point from the center of the frame.
   *
   * @param pos      Coordinate
   * @param offset   Distance perpendicular to the border, inwards of the
   *                 border. Negative values result in a position outside of
   *                 the frame.
   * @returns obj    Positioning properties
   */
  borderPosition(
    pos: Coordinate | ViewPoint,
    offset = 0,
  ): {
    x: number;
    y: number;
    border: 'bottom' | 'left' | 'right' | 'top';
    direction: number;
  } {
    const point = this.project(pos);
    const width = this.canvasSize.x - 2 * offset;
    const height = this.canvasSize.y - 2 * offset;
    const x0 = width / 2;
    const y0 = height / 2;

    /*
     * We want to calculate the intersection of the ray from the frame center
     * in the direction of the position with the frame border, inset by
     * `offset` in every direction. To determine which border the ray
     * intersects with, we need to calculate the direction to one corner of the
     * inset frame border from the center of the frame. Because the inset is
     * constant on all sides, the aspect ratio might be different than that of
     * the frame itself.
     */
    const aspectDir = Math.atan2(height, width);

    // direction from center
    const dir = Math.atan2(point.y - this.canvasSize.y / 2, point.x - this.canvasSize.x / 2);

    let x: number;
    let y: number;
    let border: 'bottom' | 'left' | 'right' | 'top' = 'top';

    if (-aspectDir < dir && aspectDir >= dir) {
      // right border
      x = width;
      y = y0 + x0 * Math.tan(dir);
      border = 'right';
    } else if (-Math.PI + aspectDir < dir && -aspectDir >= dir) {
      // top border
      x = x0 + y0 * Math.tan(Math.PI / 2 + dir);
      y = 0;
      border = 'top';
    } else if (aspectDir < dir && Math.PI - aspectDir >= dir) {
      // bottom border
      x = x0 + y0 * Math.tan((3 * Math.PI) / 2 - dir);
      y = height;
      border = 'bottom';
    } else {
      // left border
      x = 0;
      y = y0 + x0 * Math.tan(-dir + Math.PI);
      border = 'left';
    }

    x += offset;
    y += offset;

    return { x, y, border, direction: dir };
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
