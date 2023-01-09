/**
 * Class which represents a map tile with x, y an zoom value.
 */
export default class Tile {
  constructor(readonly x: number, readonly y: number, readonly zoom: number) {}

  /**
   * Produce a string of the point values formated like `x/y/zoom`
   */
  public toString(): string {
    return `${this.x}/${this.y}/${this.zoom}`;
  }

  clone(): Tile {
    return new Tile(this.x, this.y, this.zoom);
  }
}
