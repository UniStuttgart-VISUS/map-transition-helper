import Tile from './tile';

/**
 * A Map of tiles, where a string of tile-coordinates is mapped to a bitmap
 * image of the corresponding tile.
 *
 * Note: A sample tile server (ArcGIS) is given, but you may add your own. Make
 * sure to set the maxZoom properly
 */
export default class TileMap extends EventTarget {
  private tileMap: Map<string, ImageBitmap> = new Map<string, ImageBitmap>();
  private currentlyAdding: Set<string> = new Set<string>();
  private failedTiles: Set<Tile> = new Set<Tile>();

  constructor(
    readonly tileServerUrl: string = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    private maxZoom: number = 19,
  ) {
    super();
  }

  get numTiles(): number {
    return this.tileMap.size;
  }

  /**
   * Checks if a specific tile is already in the map.
   *
   * @param tile Tile coordinates
   * @returns true if tile is in map, false otherwise
   */
  hasTile(tile: Tile): boolean {
    return this.tileMap.has(tile.toString());
  }

  /**
   * Returns the current progress of the preloading process of all transitions
   * loading into the tile map.
   *
   * Note: This request works with a slight time offset at the beginning of the
   * transition until all tile requests are pending. That is de facto
   * insignificant but in theory mentionable.
   */
  getProgress(): { loading: number; finished: number; total: number; failed: number } {
    const loading = this.currentlyAdding.size;
    const finished = this.tileMap.size;
    const failed = this.failedTiles.size;
    const total = loading + finished;

    return { loading, finished: finished - failed, failed, total };
  }

  /**
   * Resets x coordinate inside bounds to guarantee the map wraps around.
   *
   * @param tile Tile coordinates
   * @returns Tile coordinates with x coordinate in bounds
   */
  private edgeBehavior(tile: Tile): Tile {
    let correctedX = tile.x;
    while (correctedX < 0) {
      correctedX = correctedX + 2 ** tile.zoom;
    }
    correctedX = correctedX % 2 ** tile.zoom;
    const edgeCorrectedTile = new Tile(correctedX, tile.y, tile.zoom);
    return edgeCorrectedTile;
  }

  /**
   * Adds a tile into the map if it is not already added.
   *
   * @param tile Tile coordinates
   */
  async addToTileMap(tile: Tile): Promise<void> {
    if (tile.zoom > this.maxZoom) throw new Error('Tried to add a tile with illegal zoom');

    const edgeCorrectedTile = this.edgeBehavior(tile);
    const currentTileKey = edgeCorrectedTile.toString();

    if (!this.currentlyAdding.has(currentTileKey) && !this.tileMap.has(currentTileKey)) {
      this.currentlyAdding.add(currentTileKey);
      this.dispatchEvent(new CustomEvent('tileadded', { detail: tile }));

      const tileBitmap = await this.fetchTile(edgeCorrectedTile);

      if (tileBitmap !== null) this.tileMap.set(currentTileKey, tileBitmap);
      this.currentlyAdding.delete(currentTileKey);
    }

    this.checkProgress();
  }

  /**
   * Check if loading is finished, and fire a `loaded` event if that is the
   * case. This is done in a microtask to ensure the event is only fired once
   * after batched addition.
   */
  private checkProgress() {
    if (!this._checkInitiated) {
      this._checkInitiated = true;

      queueMicrotask(() => {
        this._checkInitiated = false;
        if (this.currentlyAdding.size === 0) this.dispatchEvent(new CustomEvent('loaded'));
      });
    }
  }

  private _checkInitiated = false;

  /**
   * Returns a bitmap of a specific tile from the map. If none is found, return
   * nothing.
   *
   * @param tile Tile coordinates
   * @returns Bitmap of Tile
   */
  getTileImage(tile: Tile): ImageBitmap | undefined {
    if (tile.zoom > this.maxZoom) throw new Error('Tried to get a tile with illegal zoom');

    const edgeCorrectedTile = this.edgeBehavior(tile);

    return this.tileMap.get(edgeCorrectedTile.toString());
  }

  /**
   * Returns the url for a tile with given coordinates.
   *
   * Note: make sure the url is in the correct format.
   *
   * @param coords tile coordinates
   * @returns tile url
   */
  private getTileUrl(coords: Tile): string {
    let url = this.tileServerUrl;
    url = url.replace('{x}', coords.x.toString());
    url = url.replace('{y}', coords.y.toString());
    url = url.replace('{z}', coords.zoom.toString());

    return url;
  }

  /**
   * Fetches a specific Tile from the tile server. If the fetch fails, the
   * missing tile is replaced by a blank tile.
   *
   * @param tile Tile coordinates
   * @returns Promise for a bitmap of the tile
   */
  private fetchTile(tile: Tile): Promise<ImageBitmap | null> {
    const url = this.getTileUrl(tile);

    return new Promise<ImageBitmap | null>((resolve) => {
      fetch(url)
        .then((response) => response.blob())
        .then((data) => createImageBitmap(data))
        .then((bitmap) => {
          this.dispatchEvent(new CustomEvent('tileloaded', { detail: tile }));
          resolve(bitmap);

          if (this.failedTiles.has(tile)) this.failedTiles.delete(tile);
        })
        .catch((_) => {
          this.failedTiles.add(tile);
          this.dispatchEvent(new CustomEvent('tilefailed', { detail: tile }));
          resolve(null);
        });
    });
  }

  /**
   * Can be called by the user to reload tiles that failed to be fetched.
   */
  async fetchFailedTiles(): Promise<void> {
    const tiles = Array.from(this.failedTiles);
    this.failedTiles.clear();
    tiles.forEach((tile) => this.tileMap.delete(tile.toString()));
    await Promise.all(tiles.map((tile) => this.addToTileMap(tile)));
  }
}
