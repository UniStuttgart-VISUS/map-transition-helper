const {
  createPanning,
  createPanningGreatCircle,
  createZoom,
  preloadTransition,
  joinTransitions,
  TileMap,
  createTransitionFunction,
  createLinearPanTransition,
  createPerceivedLinearZoomAndPanTransition,
  createLinearZoomAndPanTransition,
  createBoxTransition,
  createTriangularTransition,
  createVanWijkAndNuijTransition,
} = MapTransitionHelper;

const canvas = document.querySelector('canvas');

const transitionEventTypes = ['frame', 'render', 'play', 'pause', 'cancel', 'finish'];
const tilemapEventTypes = ['tileadded', 'tileloaded', 'tilefailed', 'loaded'];
const eventTypes = [...transitionEventTypes, ...tilemapEventTypes];
const eventIndicators = eventTypes.map((evt) => document.querySelector(`#event-${evt}`));
const lastFrame = eventTypes.map((_) => -30);
let currentFrameIndex = 0;

const tileMap = new TileMap(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`);

tilemapEventTypes.forEach((evt) => {
  const i = eventTypes.indexOf(evt);
  tileMap.addEventListener(evt, (_) => (lastFrame[i] = currentFrameIndex));
});

function updateTilemapStatus() {
  const { loading, finished, failed, total } = tileMap.getProgress();
  document.querySelector(
    '#tilemap-progress',
  ).innerText = `${loading}loa+${finished}fin+${failed}fail / ${total}`;
  requestAnimationFrame(updateTilemapStatus);
}
requestAnimationFrame(updateTilemapStatus);

// places
const stuttgart1 = { label: 'stuttgart', lat: 48.7449, lng: 9.1048, zoom: 17 };
const stuttgart2 = { ...stuttgart1, zoom: 12 }; // zoomed out
const pforzheim = { label: 'pforzheim', lat: 48.8905, lng: 8.7037, zoom: 12 };
const germersheim = { label: 'germersheim', lat: 49.222, lng: 8.3661, zoom: 12 };
const frankfurt1 = { label: 'frankfurt', lat: 50.1013, lng: 8.6648, zoom: 12 };
const frankfurt2 = { ...frankfurt1, zoom: 3 };
const newYork1 = { label: 'new york', lat: 40.7084, lng: -74.0176, zoom: 3 };
const newYork2 = { ...newYork1, zoom: 7 };
const philadelphia = { label: 'philadelphia', lat: 39.9417, lng: -75.1571, zoom: 13 };
const tokyo = { label: 'Tōkyō', lat: 35.689, lng: 139.692, zoom: 8 };
const berlin = { label: 'Berlin', lat: 52.52, lng: 13.405, zoom: 8 };

const places = [
  stuttgart1,
  pforzheim,
  germersheim,
  frankfurt1,
  newYork1,
  philadelphia,
  tokyo,
  berlin,
];

// intermediate transitions
const zoomOutStuttgart = createTransitionFunction(
  createPanning(stuttgart1, stuttgart2),
  createZoom(stuttgart1.zoom, stuttgart2.zoom),
);
const moveToFrankfurt = joinTransitions(
  [
    createLinearPanTransition(stuttgart2, pforzheim),
    createLinearPanTransition(pforzheim, germersheim),
    createLinearPanTransition(germersheim, frankfurt1),
  ],
  [1, 1.12, 0.8],
);
const zoomOutFrankfurt = createTransitionFunction(
  createPanning(frankfurt1, frankfurt2),
  createZoom(frankfurt1.zoom, frankfurt2.zoom),
);
const moveToNewYork = createLinearPanTransition(frankfurt2, newYork1);
const zoomInNewYork = createTransitionFunction(
  createPanning(newYork1, newYork2),
  createZoom(newYork1.zoom, newYork2.zoom),
);
const moveToPhiladelphia = createPerceivedLinearZoomAndPanTransition(newYork2, philadelphia);
const moveBackToNewYork = createPerceivedLinearZoomAndPanTransition(philadelphia, newYork2);

const concatenatedTransition = joinTransitions(
  [
    zoomOutStuttgart,
    moveToFrankfurt,
    zoomOutFrankfurt,
    moveToNewYork,
    zoomInNewYork,
    moveToPhiladelphia,
    moveBackToNewYork,
  ],
  [1, 3, 1, 2.5, 1.2, 2.3, 1.8],
);

const linearTransition = createLinearPanTransition(stuttgart2, frankfurt1);
const boxTransition = createBoxTransition(stuttgart2, frankfurt1, {
  x: canvas.width,
  y: canvas.height,
});
const triangularTransition = createTriangularTransition(stuttgart2, frankfurt1, {
  x: canvas.width,
  y: canvas.height,
});
const aroundTheWorld = joinTransitions([
  createLinearPanTransition({ lat: 0, lng: 0, zoom: 3 }, { lat: 0, lng: 120 }),
  createLinearPanTransition({ lat: 0, lng: 120, zoom: 3 }, { lat: 0, lng: -120 }),
  createLinearPanTransition({ lat: 0, lng: -120, zoom: 3 }, { lat: 0, lng: 0 }),
]);
const vanWijkAndNuij = createVanWijkAndNuijTransition(
  stuttgart1,
  newYork2,
  {
    x: canvas.width,
    y: canvas.height,
  },
  1.5,
);
let transition;
requestAnimationFrame(async (_) => {
  document.body.toggleAttribute('inert', true);
  transition = await preloadTransition(
    vanWijkAndNuij,
    { x: canvas.width, y: canvas.height },
    300,
    tileMap,
  );
  registerEventListeners(transition);
  requestAnimationFrame(() => {
    document.querySelector('#initialize')?.click();
  });
  document.body.toggleAttribute('inert', false);
});

const methodSelect = document.querySelector('#transition-method');
methodSelect.addEventListener('input', (evt) => {
  let promise;

  switch (evt.target.value) {
    case 'concatenated':
      promise = preloadTransition(
        concatenatedTransition,
        { x: canvas.width, y: canvas.height },
        1200,
        tileMap,
      );
      break;
    case 'linear':
      promise = preloadTransition(
        linearTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap,
      );
      break;
    case 'box':
      promise = preloadTransition(
        boxTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap,
      );
      break;
    case 'triangle':
      promise = preloadTransition(
        triangularTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap,
      );
      break;
    case 'around world':
      promise = preloadTransition(
        aroundTheWorld,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap,
      );
      break;
    case 'van Wijk and Nuij':
      promise = preloadTransition(
        vanWijkAndNuij,
        { x: canvas.width, y: canvas.height },
        300,
        tileMap,
      );
      break;
    default:
      throw new Error(`unknown transition method: ${evt.target.value}`);
  }

  document.body.toggleAttribute('inert', true);
  promise.then((t) => {
    transition.cancel();
    requestAnimationFrame((_) => {
      canvas
        .getContext('2d')
        .clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      transition = t;
      registerEventListeners(transition);
      document.body.toggleAttribute('inert', false);
    });
  });
});

document.querySelector('#fetch-failed').addEventListener('click', async (_) => {
  document.body.toggleAttribute('inert', true);
  await tileMap.fetchFailedTiles();
  document.body.toggleAttribute('inert', false);
});

document
  .querySelector('button#initialize')
  .addEventListener('click', (_) => transition?.initialize(canvas.getContext('2d')));
document.querySelector('button#play').addEventListener('click', (_) => transition?.play());
document.querySelector('button#pause').addEventListener('click', (_) => transition?.pause());
document.querySelector('button#cancel').addEventListener('click', (_) => transition?.cancel());

function registerEventListeners(transition) {
  transitionEventTypes.forEach((evt, i) => {
    transition.addEventListener(evt, (_) => (lastFrame[i] = currentFrameIndex));
  });

  transition.addEventListener('render', (e) => checkVisibility(e, transition.currentFrame));
}

function updateEventIndicators() {
  for (let i = 0; i < eventTypes.length; ++i) {
    const distance = currentFrameIndex - lastFrame[i];
    const falloffPercent = (100 * Math.min(distance, 30)) / 30;
    eventIndicators[i].style.filter = `grayscale(${falloffPercent.toFixed(0)}%)`;
  }

  currentFrameIndex++;
  requestAnimationFrame(updateEventIndicators);
}
requestAnimationFrame(updateEventIndicators);

const currentFrame = document.querySelector('#current-frame-nr');
function updateCurrentFrameLabel() {
  if (transition) {
    const fnr = transition.currentFrameIndex;
    const s = `Current: ${fnr}`;
    if (s !== currentFrame.innerHTML) currentFrame.innerHTML = s;
  }

  requestAnimationFrame(updateCurrentFrameLabel);
}
requestAnimationFrame(updateCurrentFrameLabel);

const frameSetInput = document.querySelector('#frame-nr-input');
document.querySelector('#submit-frame-nr').addEventListener('click', (_) => {
  const fnr = frameSetInput.valueAsNumber;
  if (transition) transition.currentFrameIndex = fnr;
});

const cursorPosition = document.querySelector('#cursor-position');
canvas.addEventListener('mouseleave', (_) => {
  cursorPosition.innerHTML = `outside canvas`;
});
requestAnimationFrame((_) => {
  const { top: canvasTop, left: canvasLeft } = canvas.getBoundingClientRect();
  function updateCursorPosition(evt) {
    if (!transition) return;

    const { layerX, layerY } = evt;
    const x = Math.round(layerX - canvasLeft);
    const y = Math.round(layerY - canvasTop);

    const frame = transition.getFrame(transition.currentFrameIndex);
    if (frame === undefined) return;

    const viewPoint = frame.unproject({ x, y });

    cursorPosition.innerHTML = `
      x: ${x}px,
      y: ${y}px,
      lat: ${viewPoint.lat.toFixed(5)},
      lng: ${viewPoint.lng.toFixed(5)},
      zoom: ${viewPoint.zoom.toFixed(2)}
    `;
  }
  canvas.addEventListener('mouseenter', updateCursorPosition);
  canvas.addEventListener('mousemove', updateCursorPosition);
});

// test visibility of some positions in the frame
function checkVisibility(evt, frame) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const x0 = width / 2;
  const y0 = height / 2;

  ctx.save();
  ctx.resetTransform();
  places.forEach((place) => {
    const point = frame.project(place);
    const isVisible = frame.isCoordinateVisible(place);

    if (isVisible) {
      // draw point
      ctx.beginPath();
      ctx.strokeStyle = 'firebrick';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'yellow';
      ctx.ellipse(point.x, point.y, 5, 5, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else {
      // draw an arrow at the edge (y is down)
      const { x, y, direction, border } = frame.borderPosition(place);

      const arrowSize = 15;
      const x1 = x + arrowSize * Math.cos(direction + Math.PI + Math.PI / 8);
      const y1 = y + arrowSize * Math.sin(direction + Math.PI + Math.PI / 8);
      const x2 = x + arrowSize * Math.cos(direction + Math.PI - Math.PI / 8);
      const y2 = y + arrowSize * Math.sin(direction + Math.PI - Math.PI / 8);

      ctx.beginPath();
      ctx.strokeStyle = 'none';
      ctx.fillStyle = 'black';
      ctx.moveTo(x, y);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();

      // arrow segment, testing offset feature
      const arrowSegmentLength = 20 + arrowSize;
      const {
        x: segmentX,
        y: segmentY,
        border: borderArrow,
      } = frame.borderPosition(place, arrowSegmentLength);
      const startX = x + (arrowSize - 3) * Math.cos(direction + Math.PI);
      const startY = y + (arrowSize - 3) * Math.sin(direction + Math.PI);

      ctx.beginPath();
      ctx.strokeStyle = 'black';
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.moveTo(startX, startY);
      ctx.lineTo(segmentX, segmentY);
      ctx.stroke();

      // simulate inset maps with an offset of arrowSegmentLength, check that
      // they are placed on the correct border
      const colors = {
        top: 'firebrick',
        bottom: 'forestgreen',
        left: 'rebeccapurple',
        right: 'steelblue',
      };

      ctx.beginPath();
      ctx.strokeStyle = colors[borderArrow];
      ctx.lineWidth = 2;
      ctx.strokeRect(
        segmentX - arrowSegmentLength,
        segmentY - arrowSegmentLength,
        2 * arrowSegmentLength,
        2 * arrowSegmentLength,
      );

      // test offset for isCoordinateVisible around the simulated inset map
      [
        [segmentX - arrowSegmentLength, segmentY - arrowSegmentLength, 1],
        [segmentX + arrowSegmentLength, segmentY + arrowSegmentLength, -1],
      ].forEach(([startX, startY, direction]) => {
        [
          [1, 0],
          [0, 1],
        ].forEach(([dx, dy]) => {
          [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((alpha) => {
            const x = startX + direction * dx * alpha * 2 * arrowSegmentLength;
            const y = startY + direction * dy * alpha * 2 * arrowSegmentLength;
            const coords = frame.unproject({ x, y });
            const visible = frame.isCoordinateVisible(coords, arrowSegmentLength);

            ctx.strokeStyle = 'none';
            ctx.fillStyle = visible ? 'green' : 'red';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
          });
        });
      });
    }
  });
  ctx.restore();
}
