const assets = window.LEVIR_MAIN_ASSETS || {};

const demoTrack = document.querySelector("[data-demo-track]");
const p1Grid = document.querySelector("[data-p1-grid]");
const p2Grid = document.querySelector("[data-p2-grid]");

const demoDeck = [...(assets.demo || [])];
const p1Images = assets.datasetP1 || [];
const p2Images = assets.datasetP2 || [];

const DEMO_RENDER_COUNT = 14;
const DEMO_ROTATE_COUNT = 2;
const P1_BATCH = 35;
const P2_BATCH = 448;

let demoBusy = false;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(items, count) {
  if (!items.length) return [];
  if (items.length <= count) return shuffle(items);
  return shuffle(items).slice(0, count);
}

function imageNode(src, alt) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}

function showEmpty(target, message) {
  if (!target) return;
  target.replaceChildren();
  const node = document.createElement("p");
  node.className = "empty-state";
  node.textContent = message;
  target.append(node);
}

function visibleDemoItems() {
  if (!demoDeck.length) return [];
  return Array.from(
    { length: Math.min(DEMO_RENDER_COUNT, demoDeck.length) },
    (_, index) => demoDeck[index % demoDeck.length],
  );
}

function renderDemo() {
  if (!demoTrack) return;
  if (!demoDeck.length) {
    showEmpty(demoTrack, "No demonstration images were found.");
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleDemoItems().forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.append(imageNode(item.src, `LEVIRDet demonstration sample ${index + 1}`));
    fragment.append(card);
  });
  demoTrack.replaceChildren(fragment);
}

function demoStepWidth() {
  const firstCard = demoTrack?.querySelector(".gallery-card");
  if (!firstCard || !demoTrack) return 0;
  const styles = getComputedStyle(demoTrack);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
  return firstCard.getBoundingClientRect().width + gap;
}

function finishDemoMove() {
  demoTrack.classList.remove("is-moving");
  demoTrack.style.transform = "";
  demoBusy = false;
}

function rotateDemo(direction) {
  if (!demoTrack || demoDeck.length <= DEMO_ROTATE_COUNT || demoBusy) return;
  demoBusy = true;

  const step = demoStepWidth();
  if (!step) {
    demoBusy = false;
    return;
  }

  if (direction > 0) {
    demoTrack.classList.add("is-moving");
    demoTrack.style.transform = `translateX(-${step}px)`;
    demoTrack.addEventListener(
      "transitionend",
      () => {
        demoDeck.push(...demoDeck.splice(0, DEMO_ROTATE_COUNT));
        renderDemo();
        finishDemoMove();
      },
      { once: true },
    );
    return;
  }

  demoDeck.unshift(...demoDeck.splice(-DEMO_ROTATE_COUNT));
  renderDemo();
  demoTrack.classList.remove("is-moving");
  demoTrack.style.transform = `translateX(-${step}px)`;
  demoTrack.getBoundingClientRect();
  requestAnimationFrame(() => {
    demoTrack.classList.add("is-moving");
    demoTrack.style.transform = "translateX(0)";
    demoTrack.addEventListener("transitionend", finishDemoMove, { once: true });
  });
}

function refreshDemo() {
  if (!demoDeck.length || demoBusy) return;
  const shuffled = shuffle(demoDeck);
  demoDeck.splice(0, demoDeck.length, ...shuffled);
  renderDemo();
}

function renderSceneGrid() {
  if (!p1Grid) return;
  const items = sample(p1Images, P1_BATCH);
  if (!items.length) {
    showEmpty(p1Grid, "No dataset scene images were found.");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const tile = document.createElement("div");
    tile.className = "scene-tile";
    tile.append(imageNode(item.src, `LEVIRDet-159 scene sample ${index + 1}`));
    fragment.append(tile);
  });
  p1Grid.replaceChildren(fragment);
}

function renderCropGrid() {
  if (!p2Grid) return;
  const items = sample(p2Images, P2_BATCH);
  if (!items.length) {
    showEmpty(p2Grid, "No bounding-box crop images were found.");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const tile = document.createElement("div");
    tile.className = "crop-tile";
    tile.title = item.label || "LEVIRDet crop";
    tile.append(imageNode(item.src, `${item.label || "Object"} crop sample ${index + 1}`));
    fragment.append(tile);
  });
  p2Grid.replaceChildren(fragment);
}

function wireControls() {
  document.querySelector("[data-demo-next]")?.addEventListener("click", () => rotateDemo(1));
  document.querySelector("[data-demo-prev]")?.addEventListener("click", () => rotateDemo(-1));
  document.querySelector("[data-demo-refresh]")?.addEventListener("click", refreshDemo);
  document.querySelector("[data-p1-refresh]")?.addEventListener("click", renderSceneGrid);
  document.querySelector("[data-p2-refresh]")?.addEventListener("click", renderCropGrid);
}

function init() {
  refreshDemo();
  renderSceneGrid();
  renderCropGrid();
  wireControls();
}

init();
