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
} = MapTransitionHelper;

const canvas = document.querySelector('canvas');

const transitionEventTypes = ['frame', 'render', 'play', 'pause', 'cancel', 'finish'];
const tilemapEventTypes = ['tileadded', 'tileloaded', 'tilefailed', 'loaded'];
const eventTypes = [...transitionEventTypes, ...tilemapEventTypes];
const eventIndicators = eventTypes.map(evt => document.querySelector(`#event-${evt}`));
const lastFrame = eventTypes.map(_ => -30);
let currentFrameIndex = 0;

const tileMap = new TileMap(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`);

tilemapEventTypes.forEach(evt => {
  const i = eventTypes.indexOf(evt);
  tileMap.addEventListener(evt, _ => lastFrame[i] = currentFrameIndex);
});

function updateTilemapStatus() {
  const { loading, finished, failed, total } = tileMap.getProgress();
  document.querySelector('#tilemap-progress').innerText = `${loading}loa+${finished}fin+${failed}fail / ${total}`;
  requestAnimationFrame(updateTilemapStatus);
}
requestAnimationFrame(updateTilemapStatus);

// places
const stuttgart1 = { lat: 48.7449, lng: 9.1048, zoom: 17 };
const stuttgart2 = { ...stuttgart1, zoom: 12 };  // zoomed out
const pforzheim = { lat: 48.8905, lng: 8.7037, zoom: 12 };
const germersheim = { lat: 49.2220, lng: 8.3661, zoom: 12 };
const frankfurt1 = { lat: 50.1013, lng: 8.6648, zoom: 12 };
const frankfurt2 = { ...frankfurt1, zoom: 3 };
const newYork1 = { lat: 40.7084, lng: -74.0176, zoom: 3 };
const newYork2 = { ...newYork1, zoom: 7 };
const philadelphia = { lat: 39.9417, lng: -75.1571, zoom: 13 };

// intermediate transitions
const zoomOutStuttgart = createTransitionFunction(
  createPanning(stuttgart1, stuttgart2),
  createZoom(stuttgart1.zoom, stuttgart2.zoom)
);
const moveToFrankfurt = joinTransitions([
  createLinearPanTransition(stuttgart2, pforzheim),
  createLinearPanTransition(pforzheim, germersheim),
  createLinearPanTransition(germersheim, frankfurt1),
], [1, 1.12, 0.8]);
const zoomOutFrankfurt = createTransitionFunction(
  createPanning(frankfurt1, frankfurt2),
  createZoom(frankfurt1.zoom, frankfurt2.zoom)
);
const moveToNewYork = createLinearPanTransition(frankfurt2, newYork1);
const zoomInNewYork = createTransitionFunction(
  createPanning(newYork1, newYork2),
  createZoom(newYork1.zoom, newYork2.zoom)
);
const moveToPhiladelphia = createPerceivedLinearZoomAndPanTransition(newYork2, philadelphia);
const moveBackToNewYork = createPerceivedLinearZoomAndPanTransition(philadelphia, newYork2);

const concatenatedTransition = joinTransitions([
  zoomOutStuttgart,
  moveToFrankfurt,
  zoomOutFrankfurt,
  moveToNewYork,
  zoomInNewYork,
  moveToPhiladelphia,
  moveBackToNewYork,
], [
  1, 3, 1, 2.5, 1.2, 2.3, 1.8,
]);

const linearTransition = createLinearPanTransition(stuttgart2, frankfurt1);
const boxTransition = createBoxTransition(stuttgart2, frankfurt1, { x: canvas.width, y: canvas.height });
const triangularTransition = createTriangularTransition(stuttgart2, frankfurt1, { x: canvas.width, y: canvas.height });
const aroundTheWorld = joinTransitions([
  createLinearPanTransition({ lat: 0, lng: 0, zoom: 3 }, { lat: 0, lng: 120 }),
  createLinearPanTransition({ lat: 0, lng: 120, zoom: 3 }, { lat: 0, lng: -120 }),
  createLinearPanTransition({ lat: 0, lng: -120, zoom: 3 }, { lat: 0, lng: 0 }),
]);
let transition;
requestAnimationFrame(async _ => {
  document.body.toggleAttribute('inert', true);
  transition = await preloadTransition(
    linearTransition,
    { x: canvas.width, y: canvas.height },
    180,
    tileMap);
  registerEventListeners(transition);
  document.body.toggleAttribute('inert', false);
});

const methodSelect = document.querySelector('#transition-method');
requestAnimationFrame(_ => { methodSelect.value = 'linear' });

methodSelect.addEventListener('input', evt => {
  let promise;

  switch (evt.target.value) {
    case 'concatenated':
      promise = preloadTransition(
        concatenatedTransition,
        { x: canvas.width, y: canvas.height },
        1200,
        tileMap);
      break;
    case 'linear':
      promise = preloadTransition(
        linearTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap);
      break;
    case 'box':
      promise = preloadTransition(
        boxTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap);
      break;
    case 'triangle':
      promise = preloadTransition(
        triangularTransition,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap);
      break;
    case 'around world':
      promise = preloadTransition(
        aroundTheWorld,
        { x: canvas.width, y: canvas.height },
        180,
        tileMap);
      break;
    default:
      throw new Error(`unknown transition method: ${evt.target.value}`);
  }

  document.body.toggleAttribute('inert', true);
  promise.then(t => {
    transition.cancel();
    requestAnimationFrame(_ => {
      canvas.getContext('2d').clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      transition = t;
      registerEventListeners(transition);
      document.body.toggleAttribute('inert', false);
    });
  });
});


document.querySelector('#fetch-failed').addEventListener('click', async _ => {
  document.body.toggleAttribute('inert', true);
  await tileMap.fetchFailedTiles();
  document.body.toggleAttribute('inert', false);
});


document.querySelector('button#initialize').addEventListener('click', _ => transition?.initialize(canvas.getContext('2d')));
document.querySelector('button#play').addEventListener('click', _ => transition?.play());
document.querySelector('button#pause').addEventListener('click', _ => transition?.pause());
document.querySelector('button#cancel').addEventListener('click', _ => transition?.cancel());

function registerEventListeners(transition) {
  transitionEventTypes.forEach((evt, i) => {
    transition.addEventListener(evt, _ => lastFrame[i] = currentFrameIndex);
  });
}

function updateEventIndicators() {
  for (let i = 0; i < eventTypes.length; ++i) {
    const distance = currentFrameIndex - lastFrame[i];
    const falloffPercent = 100 * Math.min(distance, 30) / 30;
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
document.querySelector('#submit-frame-nr').addEventListener('click', _ => {
  const fnr = frameSetInput.valueAsNumber;
  if (transition) transition.currentFrameIndex = fnr;
});


const cursorPosition = document.querySelector('#cursor-position');
canvas.addEventListener('mouseleave', _ => {
  cursorPosition.innerHTML = `outside canvas`;
});
requestAnimationFrame(_ => {
  const { top: canvasTop, left: canvasLeft } = canvas.getBoundingClientRect();
  function updateCursorPosition(evt) {
    if (!transition) return;

    const { layerX, layerY } = evt;
    const x = Math.round(layerX - canvasLeft);
    const y = Math.round(layerY - canvasTop);

    const frame = transition.getFrame(transition.currentFrameIndex);
    if (frame === undefined) return;

    const viewPoint = frame.project({ x, y });

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
