const COARSE_IMAGE_BASE = "./imgs/";
const FINE_IMAGE_BASE = "./fine-imgs/";
const UWD_IMAGE_BASE = "./uwd-imgs/";

const taskCards = Array.from(document.querySelectorAll(".task-card"));
const shiftButtons = document.querySelectorAll("[data-shift]");
const demoScreen = document.querySelector('[data-view="demo"]');
const pickerScreen = document.querySelector('[data-view="picker"]');
const openPicker = document.querySelector("#openPicker");
const backToDemo = document.querySelector("#backToDemo");
const thumbGrid = document.querySelector("#thumbGrid");
const statusNode = document.querySelector("#status");
const sourceImage = document.querySelector("#sourceImage");
const visImage = document.querySelector("#visImage");
const detectionStage = document.querySelector("#detectionStage");
const boxLayer = document.querySelector("#boxLayer");
const hierarchyPanel = document.querySelector("#hierarchyPanel");
const hierarchyTitle = document.querySelector("#hierarchyTitle");
const hierarchyContent = document.querySelector("#hierarchyContent");
const hierarchyModeButtons = document.querySelectorAll("[data-hierarchy-mode]");

const taskOrder = ["wide", "object", "fine"];
const categoryColors = [
  "#f94144", "#f3722c", "#f8961e", "#f9c74f", "#90be6d", "#43aa8b",
  "#4d908e", "#577590", "#277da1", "#9b5de5", "#f15bb5", "#00bbf9",
  "#00f5d4", "#80ed99", "#ff006e", "#fb5607", "#ffbe0b", "#8338ec",
  "#3a86ff", "#06d6a0", "#ef476f", "#118ab2", "#ffd166", "#8ac926",
  "#ff595e", "#1982c4", "#6a4c93", "#bc6c25", "#2a9d8f", "#e76f51",
];

const taxonomy = {
  plane: {
    Airliner: [
      "A220", "A321", "A330", "A350", "ARJ21", "Boeing737", "Boeing747",
      "Boeing777", "Boeing787", "C919",
    ],
    notairliner: [
      "A-10", "A-26", "B-1", "B-1B", "B-2", "B-29", "B-52", "C-130",
      "C-135", "C-17", "C-21", "C-5", "E-3", "E-8", "F-15", "F-16",
      "F-22", "F-5", "FA-18", "KC-10", "KC-135", "P-3C", "P-63",
      "SU-24", "SU-34", "SU-35", "T-43", "T-6", "TU-160", "TU-22",
      "TU-95", "U-2",
    ],
    "other-airplane": [],
  },
  vehicle: {
    car: [], bus: [], camping_car: [], "Cargo Truck": [], "dump truck": [],
    Excavator: [], other: [], pickup: [], "small-vehicle": [], tractor: [],
    Trailer: [], "Truck Tractor": [], van: [],
  },
  ship: {
    civil_ship: [
      "bargePontoon", "bulkCarrier", "Car_carrier", "coastGuard",
      "Container_Ship", "Dock", "dredgerReclamation", "dredging", "drill",
      "Engineering_Ship", "Fishing_Vessel", "Hovercraft", "Large_sail_ship",
      "Liquid_Cargo_Ship", "lpg", "Merchant", "offshore", "oreCarrier",
      "passenger", "RoRo", "serviceCraft", "Small_leisure_craft",
      "small_Ro-Ro_ferry", "tiny_boat", "Tugboat", "yacht",
    ],
    war: {
      AOE: [], AS: ["Auxiliary Ships", "Masyuu AS", "Sanantonio AS", "other AS"],
      C: ["other cruiser", "Ticonderoga"],
      commander: ["other Commander", "USS Blue Ridge (LCC-19)"],
      CV: ["Enterprise", "Midway", "Nimitz", "other Aircraft carrier"],
      DD: ["Arleigh Burke DD", "Asagiri DD", "Atago DD", "Hatsuyuki DD", "Hyuga DDH", "other Destroyer"],
      EPF: [], FF: ["Perry FF", "Frigate"],
      Landing: ["Austin LL", "LHA LL", "LSD_41 LL", "Osumi LL", "Wasp LL", "other landing"],
      LCS: ["DULI"], "Medical ship": [], "other Warship": [], patrolForce: [],
      Submarine: [], "Test ship": [],
    },
  },
};

const datasets = {
  coarse: {
    data: window.LEVIR_DEMO_DATA,
    imageBase: COARSE_IMAGE_BASE,
    defaultFile: "0002.png",
    categories: new Map(),
    annotationsByImage: new Map(),
    images: [],
  },
  fine: {
    data: window.LEVIR_FINE_DATA,
    imageBase: FINE_IMAGE_BASE,
    defaultFile: "87_part11__136c7df11.jpg",
    categories: new Map(),
    annotationsByImage: new Map(),
    images: [],
  },
  uwd: {
    data: window.LEVIR_UWD_DATA,
    imageBase: UWD_IMAGE_BASE,
    defaultFile: "0030.png",
    categories: new Map(),
    annotationsByImage: new Map(),
    images: [],
  },
};

let centerTaskIndex = 1;
let activeMode = "coarse";
let hierarchyMode = "tree";
let selectedByMode = { coarse: null, fine: null, uwd: null };
let currentImage = null;
let currentAnnotations = [];

function showStatus(message, sticky = false) {
  statusNode.textContent = message;
  statusNode.classList.add("is-visible");
  if (!sticky) {
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => statusNode.classList.remove("is-visible"), 2200);
  }
}

function normalizeName(value) {
  return value == null ? "" : String(value).trim();
}

function flattenTree(tree, parent = null, edges = []) {
  Object.entries(tree || {}).forEach(([name, children]) => {
    if (parent) edges.push([parent, name]);
    if (Array.isArray(children)) {
      children.forEach((child) => edges.push([name, child]));
    } else if (children && typeof children === "object") {
      flattenTree(children, name, edges);
    }
  });
  return edges;
}

const taxonomyChildren = new Map();
flattenTree(taxonomy).forEach(([parent, child]) => {
  if (!taxonomyChildren.has(parent)) taxonomyChildren.set(parent, []);
  taxonomyChildren.get(parent).push(child);
});

function addObservedHierarchy(ann) {
  const levels = getFineLevels(ann, false);
  levels.forEach((level, index) => {
    const parent = levels[index - 1];
    if (!parent) return;
    if (!taxonomyChildren.has(parent)) taxonomyChildren.set(parent, []);
    if (!taxonomyChildren.get(parent).includes(level)) {
      taxonomyChildren.get(parent).push(level);
    }
  });
}

function getDataset() {
  return datasets[activeMode];
}

function categoryName(dataset, categoryId) {
  return dataset.categories.get(categoryId) || `category-${categoryId}`;
}

function getFineLevels(ann, includeFallback = true) {
  const dataset = datasets.fine;
  const baseName = categoryName(dataset, ann.category_id);
  const levels = [
    ann.fine_category_level1,
    ann.fine_category_level2,
    ann.fine_category_level3,
    ann.fine_category_level4,
  ].map(normalizeName).filter(Boolean);
  const fineName = normalizeName(ann.fine_category_name);
  if (fineName && !levels.includes(fineName)) levels.push(fineName);
  if (!levels.length && includeFallback) levels.push(baseName);
  return levels;
}

function annotationLabel(ann, dataset) {
  if (activeMode === "fine") {
    const levels = getFineLevels(ann);
    return normalizeName(ann.fine_category_name) || levels[levels.length - 1] || categoryName(dataset, ann.category_id);
  }
  return categoryName(dataset, ann.category_id);
}

function annotationKey(ann, dataset) {
  return activeMode === "fine" ? annotationLabel(ann, dataset) : String(ann.category_id);
}

function colorForAnnotation(ann, dataset) {
  if (activeMode === "fine") {
    let hash = 0;
    const label = annotationLabel(ann, dataset);
    for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return categoryColors[hash % categoryColors.length];
  }
  return categoryColors[(Number(ann.category_id) - 1) % categoryColors.length];
}

function scoreOf(annotation) {
  return Number(annotation.score ?? annotation.confidence ?? 0);
}

function prepareDataset(name) {
  const dataset = datasets[name];
  if (!dataset.data) return;
  dataset.categories = new Map(dataset.data.categories.map((category) => [category.id, category.name]));
  dataset.annotationsByImage = new Map();
  dataset.data.annotations.forEach((annotation) => {
    if (!dataset.annotationsByImage.has(annotation.image_id)) dataset.annotationsByImage.set(annotation.image_id, []);
    dataset.annotationsByImage.get(annotation.image_id).push(annotation);
    if (name === "fine") addObservedHierarchy(annotation);
  });
  dataset.annotationsByImage.forEach((anns) => anns.sort((a, b) => scoreOf(b) - scoreOf(a)));
  dataset.images = dataset.data.images
    .filter((image) => dataset.annotationsByImage.has(image.id))
    .sort((a, b) => compareImages(a, b, dataset));
}

function imageSortKey(image, dataset) {
  const anns = dataset.annotationsByImage.get(image.id) || [];
  if (dataset === datasets.fine) {
    const hasFine = anns.some((ann) => getFineLevels(ann, false).length > 0);
    return [hasFine ? 0 : 1, -anns.length, image.file_name];
  }
  if (dataset === datasets.uwd) {
    return [-anns.length, image.file_name];
  }
  const hasCars = anns.some((ann) => categoryName(dataset, ann.category_id) === "car");
  return [hasCars ? 0 : 1, -anns.length, image.file_name];
}

function compareImages(a, b, dataset) {
  const ak = imageSortKey(a, dataset);
  const bk = imageSortKey(b, dataset);
  for (let i = 0; i < ak.length; i += 1) {
    if (ak[i] < bk[i]) return -1;
    if (ak[i] > bk[i]) return 1;
  }
  return 0;
}

function updateTasks() {
  const center = taskOrder[centerTaskIndex];
  const left = taskOrder[(centerTaskIndex + taskOrder.length - 1) % taskOrder.length];
  const right = taskOrder[(centerTaskIndex + 1) % taskOrder.length];
  taskCards.forEach((card) => {
    card.classList.remove("is-left", "is-center", "is-right", "is-side");
    if (card.dataset.task === center) card.classList.add("is-center");
    else if (card.dataset.task === left) card.classList.add("is-left", "is-side");
    else if (card.dataset.task === right) card.classList.add("is-right", "is-side");
  });
  const mode = center === "fine" ? "fine" : center === "wide" ? "uwd" : "coarse";
  setMode(mode);
}

function shiftTasks(delta) {
  centerTaskIndex = (centerTaskIndex + delta + taskOrder.length) % taskOrder.length;
  updateTasks();
}

function setMode(mode) {
  if (activeMode === mode && currentImage) return;
  activeMode = mode;
  document.body.classList.toggle("mode-fine", mode === "fine");
  renderThumbs();
  const dataset = getDataset();
  const selectedId = selectedByMode[mode];
  const image =
    dataset.images.find((item) => String(item.id) === String(selectedId)) ||
    dataset.images.find((item) => item.file_name === dataset.defaultFile) ||
    dataset.images[0];
  if (image) setSelectedImage(image.id);
  resetHierarchy();
}

function setView(view) {
  const picker = view === "picker";
  demoScreen.classList.toggle("is-active", !picker);
  pickerScreen.classList.toggle("is-active", picker);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function getImageRatio(image) {
  return `${Number(image.width) || 1} / ${Number(image.height) || 1}`;
}

function renderBoxes(image) {
  const dataset = getDataset();
  const anns = dataset.annotationsByImage.get(image.id) || [];
  currentAnnotations = anns;
  boxLayer.innerHTML = "";
  anns.forEach((ann, index) => {
    const [x, y, width, height] = ann.bbox;
    const node = document.createElement("div");
    const label = annotationLabel(ann, dataset);
    const pathLabel = activeMode === "fine" ? (getFineLevels(ann).join(" / ") || label) : label;
    node.className = "det-box";
    node.style.left = `${(x / image.width) * 100}%`;
    node.style.top = `${(y / image.height) * 100}%`;
    node.style.width = `${(width / image.width) * 100}%`;
    node.style.height = `${(height / image.height) * 100}%`;
    node.style.setProperty("--box-color", colorForAnnotation(ann, dataset));
    node.dataset.categoryId = annotationKey(ann, dataset);
    node.dataset.category = pathLabel;
    node.dataset.index = String(index);
    node.addEventListener("mouseenter", () => highlightCategory(node.dataset.categoryId, node, ann));
    node.addEventListener("mouseleave", clearHighlight);
    boxLayer.appendChild(node);
  });
}

function highlightCategory(categoryId, labelNode, ann) {
  const boxes = Array.from(document.querySelectorAll(".det-box"));
  let labelPlaced = false;
  boxes.forEach((box) => {
    const same = box.dataset.categoryId === categoryId;
    box.classList.toggle("is-highlight", same);
    box.classList.toggle("is-muted", !same);
    box.classList.remove("show-label");
    if (same && box === labelNode && !labelPlaced) {
      box.classList.add("show-label");
      labelPlaced = true;
    }
  });
  if (activeMode === "fine") renderHierarchy(ann);
}

function clearHighlight() {
  document.querySelectorAll(".det-box").forEach((box) => {
    box.classList.remove("is-highlight", "is-muted", "show-label");
  });
}

function setSelectedImage(imageId) {
  const dataset = getDataset();
  const image = dataset.images.find((item) => String(item.id) === String(imageId));
  if (!image) return;
  currentImage = image;
  selectedByMode[activeMode] = image.id;
  const fileName = image.web_file_name || image.file_name;
  const src = `${dataset.imageBase}${fileName}`;
  sourceImage.src = src;
  visImage.src = src;
  sourceImage.alt = image.file_name;
  visImage.alt = `${image.file_name} with detections`;
  detectionStage.style.aspectRatio = getImageRatio(image);
  document.querySelector(".original-stage").style.aspectRatio = getImageRatio(image);
  renderBoxes(image);
  document.querySelectorAll(".image-choice").forEach((button) => {
    button.classList.toggle("is-selected", String(button.dataset.imageId) === String(image.id));
  });
  resetHierarchy();
}

function renderThumbs() {
  const dataset = getDataset();
  thumbGrid.innerHTML = "";
  dataset.images.forEach((image) => {
    const button = document.createElement("button");
    const ratio = Number(image.width) / Number(image.height || 1);
    button.className = "image-choice";
    if (ratio > 1.35) button.classList.add("is-wide");
    if (ratio < 0.75) button.classList.add("is-tall");
    button.type = "button";
    button.dataset.imageId = image.id;
    const fileName = image.web_file_name || image.file_name;
    button.innerHTML = `<img src="${dataset.imageBase}${fileName}" alt="${image.file_name}">`;
    button.addEventListener("click", () => {
      setSelectedImage(image.id);
      setView("demo");
    });
    thumbGrid.appendChild(button);
  });
}

function limitedList(items, active, limit = 5) {
  const unique = [...new Set(items.filter(Boolean).filter((item) => item !== active))];
  return { shown: unique.slice(0, limit), hidden: Math.max(0, unique.length - limit) };
}

function rootSiblings(root) {
  return ["plane", "vehicle", "ship"].filter((item) => item !== root);
}

function relationForAnnotation(ann) {
  const dataset = datasets.fine;
  const levels = getFineLevels(ann);
  const target = annotationLabel(ann, dataset);
  if (!levels.includes(target)) levels.push(target);
  const parent = levels.length > 1 ? levels[levels.length - 2] : null;
  const root = levels[0] || target;
  const siblings = parent ? taxonomyChildren.get(parent) || [] : rootSiblings(root);
  const children = taxonomyChildren.get(target) || [];
  return { levels, target, parent, root, siblings, children };
}

function nodeClass(name, relation) {
  if (name === relation.target) return "tree-node is-target";
  if (relation.levels.includes(name)) return "tree-node is-path";
  return "tree-node is-dim";
}

function renderNode(name, relation) {
  return `<span class="${nodeClass(name, relation)}">${escapeHtml(name)}</span>`;
}

function renderHierarchy(ann) {
  const relation = relationForAnnotation(ann);
  hierarchyTitle.textContent = relation.levels.join(" / ");
  if (hierarchyMode === "graph") renderGraphHierarchy(relation);
  else renderTreeHierarchy(relation);
}

function renderTreeHierarchy(relation) {
  const rows = relation.levels.map((level, index) => {
    const parent = relation.levels[index - 1];
    const siblings = parent ? taxonomyChildren.get(parent) || [] : rootSiblings(level);
    const { shown, hidden } = limitedList(siblings, level, 5);
    const nodes = [renderNode(level, relation), ...shown.map((item) => renderNode(item, relation))];
    if (hidden) nodes.push(`<span class="tree-more">... ${hidden} more</span>`);
    return `<div class="tree-row"><span class="tree-label">${index ? "Level " + (index + 1) : "Root"}</span><div class="tree-nodes">${nodes.join("")}</div></div>`;
  });
  const childList = limitedList(relation.children, "", 6);
  rows.push(`<div class="tree-row"><span class="tree-label">Children</span><div class="tree-nodes">${
    childList.shown.length ? childList.shown.map((item) => renderNode(item, relation)).join("") : '<span class="tree-empty">No finer child labels</span>'
  }${childList.hidden ? `<span class="tree-more">... ${childList.hidden} more</span>` : ""}</div></div>`);
  hierarchyContent.innerHTML = `<div class="tree-view">${rows.join("")}</div>`;
}

function renderGraphHierarchy(relation) {
  const ancestors = relation.levels.slice(0, -1);
  const siblingList = limitedList(relation.siblings, relation.target, 5);
  const childList = limitedList(relation.children, "", 5);
  hierarchyContent.innerHTML = `
    <div class="graph-view">
      <div class="graph-card">
        <span>Ancestors</span>
        <strong>${ancestors.length ? ancestors.map(escapeHtml).join(" -> ") : "None"}</strong>
      </div>
      <div class="graph-card is-target">
        <span>Selected label</span>
        <strong>${escapeHtml(relation.target)}</strong>
      </div>
      <div class="graph-card">
        <span>Siblings</span>
        <strong>${siblingList.shown.length ? siblingList.shown.map(escapeHtml).join(", ") : "None"}${siblingList.hidden ? ", ..." : ""}</strong>
      </div>
      <div class="graph-card">
        <span>Children</span>
        <strong>${childList.shown.length ? childList.shown.map(escapeHtml).join(", ") : "No finer child labels"}${childList.hidden ? ", ..." : ""}</strong>
      </div>
    </div>`;
}

function resetHierarchy() {
  if (activeMode !== "fine") return;
  hierarchyTitle.textContent = "Hover over an object";
  hierarchyContent.innerHTML = "Hover over a fine-grained detection box to inspect its parent, ancestors, children, and sibling categories.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initialize() {
  if (!datasets.coarse.data || !datasets.fine.data || !datasets.uwd.data) {
    showStatus("Could not load demo data. Check demo-data.js, fine-data.js, and uwd-data.js.", true);
    return;
  }
  prepareDataset("coarse");
  prepareDataset("fine");
  prepareDataset("uwd");
  updateTasks();
  showStatus("Demo ready");
}

shiftButtons.forEach((button) => {
  button.addEventListener("click", () => shiftTasks(Number(button.dataset.shift)));
});

hierarchyModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    hierarchyMode = button.dataset.hierarchyMode;
    hierarchyModeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    const hovered = document.querySelector(".det-box.is-highlight");
    if (hovered && currentAnnotations[Number(hovered.dataset.index)]) {
      renderHierarchy(currentAnnotations[Number(hovered.dataset.index)]);
    }
  });
});

openPicker.addEventListener("click", () => setView("picker"));
backToDemo.addEventListener("click", () => setView("demo"));

initialize();
