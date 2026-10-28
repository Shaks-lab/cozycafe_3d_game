
import * as THREE from "three";

// =============================================
// COZY CAFE 3D - FIRST PLAYABLE VERSION
// =============================================

const $ = (id) => document.getElementById(id);

const ui = {
  cash: $("cash"),
  served: $("served"),
  customerName: $("customer-name"),
  orderName: $("order-name"),
  patience: $("patience-bar"),
  status: $("order-status"),
  interaction: $("interaction"),
  interactionText: $("interaction-text"),
  toast: $("toast"),
  start: $("start-screen"),
  pause: $("pause-screen"),
  end: $("end-screen"),
  startButton: $("start-button"),
  resumeButton: $("resume-button"),
  restartButton: $("restart-button"),
  summary: $("day-summary"),
  day: $("day-number"),
    shop: $("shop-screen"),
  shopButton: $("shop-button"),
  upgradeItems: $("upgrade-items"),
  closeShopButton: $("close-shop-button")
};

// ---------- Game state ----------

// ---------- Game state ----------

let cash = 50;
let served = 0;
let totalCustomersServed = 0;
let dayNumber = 1;

// ---------- Café upgrades ----------
let upgrades = {
  betterMachine: false,
  fasterEquipment: false,
  customerService: false,
  betterTips: false,
  premiumBeans: false
};

const upgradeCatalog = [
  {
    id: "betterMachine",
    name: "Better Coffee Machine",
    price: 100,
    description: "Earn 10% more from every drink."
  },
  {
    id: "fasterEquipment",
    name: "Faster Equipment",
    price: 150,
    description: "Customers arrive more frequently."
  },
  {
    id: "customerService",
    name: "Customer Service",
    price: 200,
    description: "Customers wait 15 seconds longer."
  },
  {
    id: "betterTips",
    name: "Better Tips",
    price: 250,
    description: "Earn 50% bigger tips for quick service."
  },
  {
    id: "premiumBeans",
    name: "Premium Coffee Beans",
    price: 350,
    description: "Earn 20% more from every drink."
  }
];

let dailySales = 0;
let dailyTips = 0;

let active = false;
let paused = false;
let gameOver = false;
let dayTime = 180;
let customerWait = 0;
let nextCustomerIn = 0;
let toastTimer = 0;

const SAVE_KEY = "cozyCafe3D_save_v1";

let currentOrder = null;
let preparedDrink = false;
let currentCustomer = null;
let coffeeCup = null;
let promptVisible = false;

const keys = {};
const clock = new THREE.Clock();
// ---------- Save and load progress ----------

function saveGame() {
  const saveData = {
    cash,
    dayNumber,
    totalCustomersServed,
    upgrades
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (error) {
    console.error("Could not save game progress:", error);
  }
}

function loadGame() {
  try {
    const savedData = localStorage.getItem(SAVE_KEY);

    if (!savedData) {
      return;
    }

    const data = JSON.parse(savedData);

    if (data.upgrades && typeof data.upgrades === "object") {
  upgrades = {
    ...upgrades,
    ...data.upgrades
     };
    }
    if (Number.isFinite(data.cash) && data.cash >= 0) {
      cash = data.cash;
    }

    if (Number.isInteger(data.dayNumber) && data.dayNumber >= 1) {
      dayNumber = data.dayNumber;
    }

    if (
      Number.isInteger(data.totalCustomersServed) &&
      data.totalCustomersServed >= 0
    ) {
      totalCustomersServed = data.totalCustomersServed;
    }

    console.log("Game progress loaded successfully.");
  } catch (error) {
    console.error("Could not load saved game progress:", error);
  }
}

const PLAYER_HEIGHT = 1.65;
const PLAYER_SPEED = 3.6;
const INTERACTION_DISTANCE = 3.3;
const CUSTOMER_PATIENCE = 45;

const recipes = [
  { name: "Latte", price: 8, tip: 3, color: 0xb88a60 },
  { name: "Cappuccino", price: 9, tip: 3, color: 0x9c6b43 },
  { name: "Espresso", price: 6, tip: 2, color: 0x493024 },
  { name: "Hot Chocolate", price: 7, tip: 2, color: 0x65402d },
  { name: "Tea", price: 5, tip: 2, color: 0xc9a86a }
];

const customerNames = [
  "Alex Morgan",
  "Jamie Parker",
  "Taylor Reed",
  "Sam Williams",
  "Jordan Blake",
  "Casey Brooks",
  "Riley James",
  "Avery Quinn"
];

const customerColors = [
  0x6f8eae,
  0xb87963,
  0x758e70,
  0xc69b57,
  0x9379a8,
  0x527f80
];

// ---------- Three.js setup ----------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8c8cf);
scene.fog = new THREE.Fog(0xb8c8cf, 15, 34);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, PLAYER_HEIGHT, 5.2);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

$("game").prepend(renderer.domElement);

// ---------- Materials and 3D helpers ----------

function material(color, roughness = 0.85, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    ...extra
  });
}

const mats = {
  floor: material(0x92745b),
  wall: material(0xe8d9c5),
  wood: material(0x68422e),
  lightWood: material(0xb58b60),
  darkWood: material(0x422c21),
  cream: material(0xf7ead8),
  metal: material(0x777d80, 0.3, { metalness: 0.65 }),
  green: material(0x647c59),
  glass: material(0x8ebdce, 0.25, {
    metalness: 0.05
  }),
  black: material(0x292725, 0.4),
  gold: material(0xc69b5b, 0.35, {
    metalness: 0.45
  })
};

function box(parent, x, y, z, w, h, d, mat, cast = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function cylinder(
  parent, x, y, z, radiusTop, radiusBottom,
  height, mat, segments = 16
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop, radiusBottom, height, segments
    ),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function sphere(parent, x, y, z, radius, mat) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 14),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

// ---------- Lighting ----------

scene.add(new THREE.HemisphereLight(
  0xffe9ce, 0x625044, 2.0
));

const sun = new THREE.DirectionalLight(0xffdfb1, 2.3);
sun.position.set(-4, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.normalBias = 0.035;
scene.add(sun);

function addWarmLight(x, y, z, intensity = 65) {
  const light = new THREE.PointLight(
    0xffbd78, intensity, 10, 2
  );

  light.position.set(x, y, z);
  scene.add(light);

  sphere(
    scene, x, y, z, 0.09,
    new THREE.MeshBasicMaterial({ color: 0xffdfab })
  );
}

// ---------- Café architecture ----------

function buildCafe() {
  // Floor
  box(scene, 0, -0.16, 0, 12, 0.3, 14, mats.floor);

  // Four walls
  box(scene, 0, 1.75, -7, 12, 3.5, 0.25, mats.wall);
  box(scene, -6, 1.75, 0, 0.25, 3.5, 14, mats.wall);
  box(scene, 6, 1.75, 0, 0.25, 3.5, 14, mats.wall);

  // Front wall segments leave a central entrance
  box(scene, -4.4, 1.75, 7, 3.2, 3.5, 0.25, mats.wall);
  box(scene, 4.4, 1.75, 7, 3.2, 3.5, 0.25, mats.wall);

  // Ceiling
  box(scene, 0, 3.55, 0, 12, 0.2, 14, mats.cream, false);

  // Rear windows
  for (const x of [-3.5, 0, 3.5]) {
    box(scene, x, 2.15, -6.83, 2.3, 1.7, 0.06, mats.glass, false);

    box(scene, x, 2.15, -6.76, 0.07, 1.8, 0.08, mats.darkWood, false);
    box(scene, x, 2.15, -6.76, 2.4, 0.07, 0.08, mats.darkWood, false);
    box(scene, x, 2.15, -6.76, 0.07, 1.8, 0.08, mats.darkWood, false);
  }

  // Wall trim
  box(scene, 0, 0.17, -6.82, 11.8, 0.16, 0.08, mats.darkWood);
  box(scene, -5.82, 0.17, 0, 0.08, 0.16, 13.8, mats.darkWood);
  box(scene, 5.82, 0.17, 0, 0.08, 0.16, 13.8, mats.darkWood);

  // Counter base and countertop
  box(scene, 0, 0.58, 0.1, 4.6, 1.05, 1.1, mats.wood);
  box(scene, 0, 1.13, 0.1, 4.85, 0.12, 1.3, mats.lightWood);

  // Decorative front panels
  for (const x of [-1.65, -0.55, 0.55, 1.65]) {
    box(scene, x, 0.58, 0.665, 0.72, 0.73, 0.035, mats.darkWood);
  }

  // Espresso machine
  box(scene, 0.8, 1.52, -0.05, 1.1, 0.65, 0.65, mats.black);
  box(scene, 0.8, 1.88, -0.05, 1.12, 0.09, 0.66, mats.metal);

  // Machine control panel
  box(scene, 0.8, 1.58, 0.285, 0.75, 0.22, 0.025, mats.metal);

  for (const x of [0.55, 0.8, 1.05]) {
    sphere(scene, x, 1.61, 0.31, 0.045, mats.gold);
  }

  // Group handles
  for (const x of [0.55, 1.05]) {
    cylinder(scene, x, 1.28, 0.17, 0.055, 0.055, 0.18, mats.metal);
  }

  // Cups on display shelf
  box(scene, -1.25, 1.48, -0.2, 0.8, 0.08, 0.48, mats.darkWood);

  for (let i = 0; i < 3; i++) {
    cylinder(
      scene, -1.5 + i * 0.25, 1.62, -0.2,
      0.075, 0.09, 0.18, mats.cream
    );
  }

  // Register
  box(scene, -1.85, 1.32, 0.1, 0.38, 0.26, 0.32, mats.black);
  box(scene, -1.85, 1.48, 0.1, 0.3, 0.05, 0.23, mats.green);

  // Pendant lamps
  for (const x of [-3.5, 0, 3.5]) {
    cylinder(scene, x, 3.1, 0.2, 0.018, 0.018, 0.65, mats.black);
    cylinder(scene, x, 2.77, 0.2, 0.22, 0.35, 0.2, mats.gold);
    addWarmLight(x, 2.62, 0.2, 42);
  }

  // Wall menu boards
  for (const x of [-2.0, 0, 2.0]) {
    box(scene, x, 2.4, -6.72, 1.65, 0.95, 0.09, mats.darkWood);
    box(scene, x, 2.4, -6.65, 1.5, 0.8, 0.03, mats.black);
  }

  // Simple decorative menu lettering
  const menuCanvas = document.createElement("canvas");
  menuCanvas.width = 512;
  menuCanvas.height = 256;
  const ctx = menuCanvas.getContext("2d");

  ctx.fillStyle = "#28221d";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#e8bf83";
  ctx.font = "bold 34px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("COFFEE  •  TEA", 256, 65);
  ctx.fillStyle = "#fff0d9";
  ctx.font = "25px Arial";
  ctx.fillText("Latte       $8", 256, 120);
  ctx.fillText("Espresso  $6", 256, 164);
  ctx.fillText("Tea          $5", 256, 208);

  const menuTexture = new THREE.CanvasTexture(menuCanvas);
  menuTexture.colorSpace = THREE.SRGBColorSpace;

  const menuSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.7),
    new THREE.MeshBasicMaterial({ map: menuTexture })
  );

  menuSign.position.set(0, 2.4, -6.61);
  scene.add(menuSign);

  // Small wall clock
  cylinder(scene, -5.72, 2.7, -2.5, 0.36, 0.36, 0.07, mats.darkWood);
  cylinder(scene, -5.67, 2.7, -2.5, 0.29, 0.29, 0.075, mats.cream);

  box(scene, -5.62, 2.78, -2.45, 0.035, 0.19, 0.02, mats.darkWood);
  box(scene, -5.62, 2.7, -2.41, 0.13, 0.025, 0.02, mats.darkWood);

  // Plants
  createPlant(-5.0, 0, -5.7);
  createPlant(5.0, 0, -5.7);
  createPlant(-5.0, 0, 4.7);
  createPlant(5.0, 0, 4.7);

  // Seating areas
  createTable(-3.1, -2.1);
  createTable(3.1, -2.1);
  createTable(-3.1, 3.2);
  createTable(3.1, 3.2);

  // A small rug
  box(
    scene, 0, 0.005, 4.8, 2.5, 0.025, 1.5,
    material(0x8c5c43)
  );
}

function createPlant(x, y, z) {
  cylinder(scene, x, y + 0.28, z, 0.28, 0.2, 0.55, mats.wood);

  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;

    const leaf = sphere(
      scene,
      x + Math.cos(angle) * 0.22,
      y + 0.85 + (i % 2) * 0.12,
      z + Math.sin(angle) * 0.22,
      0.23,
      mats.green
    );

    leaf.scale.set(0.7, 1.4, 0.7);
  }
}

function createTable(x, z) {
  // Tabletop and pedestal
  cylinder(scene, x, 0.92, z, 0.7, 0.7, 0.12, mats.lightWood, 24);
  cylinder(scene, x, 0.46, z, 0.11, 0.15, 0.8, mats.darkWood);
  cylinder(scene, x, 0.08, z, 0.35, 0.35, 0.12, mats.darkWood);

  // Chairs on opposite sides
  for (const offset of [-1.0, 1.0]) {
    const chairZ = z + offset;

    box(scene, x, 0.5, chairZ, 0.7, 0.12, 0.65, mats.green);
    box(
      scene, x, 0.9, chairZ + offset * 0.25,
      0.7, 0.75, 0.12, mats.darkWood
    );

    for (const dx of [-0.27, 0.27]) {
      for (const dz of [-0.24, 0.24]) {
        box(
          scene, x + dx, 0.24, chairZ + dz,
          0.07, 0.48, 0.07, mats.darkWood
        );
      }
    }
  }

  // Table centrepiece
  cylinder(scene, x, 1.02, z, 0.09, 0.09, 0.12, mats.cream);
  sphere(scene, x, 1.13, z, 0.1, mats.green);
}

// ---------- Customer character ----------

function createCustomer() {
  const group = new THREE.Group();

  const shirtColor = customerColors[
    Math.floor(Math.random() * customerColors.length)
  ];

  const shirt = material(shirtColor);
  const skin = material(0xe0ad88);
  const hair = material(0x493329);
  const trousers = material(0x454b55);

  // Body and head
  cylinder(group, 0, 1.0, 0, 0.28, 0.35, 0.8, shirt);
  sphere(group, 0, 1.65, 0, 0.23, skin);

  // Hair cap
  sphere(group, 0, 1.78, -0.02, 0.23, hair);

  // Eyes face toward +Z, where the player stands
  sphere(group, -0.08, 1.66, 0.205, 0.025, mats.black);
  sphere(group, 0.08, 1.66, 0.205, 0.025, mats.black);

  // Legs
  for (const x of [-0.12, 0.12]) {
    box(group, x, 0.4, 0, 0.13, 0.55, 0.15, trousers);
    box(group, x, 0.12, 0.04, 0.16, 0.15, 0.28, mats.black);
  }

  // Arms
  for (const x of [-0.32, 0.32]) {
    box(group, x, 0.95, 0, 0.13, 0.48, 0.14, shirt);
    sphere(group, x, 0.7, 0.03, 0.075, skin);
  }

  // Position the customer on the opposite side of the counter
  group.position.set(0, 0, -1.1);
  scene.add(group);

  return group;
}

// ---------- Customer orders ----------

function newCustomer() {
  if (gameOver || currentCustomer) return;

  currentOrder = recipes[
    Math.floor(Math.random() * recipes.length)
  ];

  currentCustomer = createCustomer();
  preparedDrink = false;
  customerWait = CUSTOMER_PATIENCE +
  (upgrades.customerService ? 15 : 0);

  const name = customerNames[
    Math.floor(Math.random() * customerNames.length)
  ];

  ui.customerName.textContent = name + " is waiting";
  ui.orderName.textContent = currentOrder.name;
  ui.status.textContent = "Waiting for their drink";

  updatePatience();

  notify("A new customer has arrived!");
}

function removeCustomer() {
  if (currentCustomer) {
    scene.remove(currentCustomer);
    currentCustomer.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
  }

  currentCustomer = null;
  currentOrder = null;
  preparedDrink = false;

  if (coffeeCup) {
    scene.remove(coffeeCup);
    coffeeCup.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
    coffeeCup = null;
  }

  ui.customerName.textContent = "Waiting for a customer";
  ui.orderName.textContent = "No active order";
  ui.status.textContent = "Next customer arriving soon";
  ui.patience.style.width = "100%";

  nextCustomerIn = upgrades.fasterEquipment ? 1.5 : 2.5;
}

function updatePatience() {
  const maxPatience = CUSTOMER_PATIENCE +
  (upgrades.customerService ? 15 : 0);

  const percentage = Math.max(
    0,
    customerWait / maxPatience * 100
  );

  ui.patience.style.width = percentage + "%";
  ui.patience.style.background =
    percentage < 30 ? "#e07b68" :
    percentage < 60 ? "#e7b66c" : "#b4cb91";
}

function prepareDrink() {
  if (!currentCustomer || !currentOrder || preparedDrink) return;

  preparedDrink = true;

  // Create a little coffee cup on the countertop
  coffeeCup = new THREE.Group();

  cylinder(
    coffeeCup, 0, 0.12, 0,
    0.13, 0.1, 0.24,
    material(0xf9eee0), 20
  );

  cylinder(
    coffeeCup, 0, 0.245, 0,
    0.1, 0.1, 0.015,
    material(currentOrder.color), 20
  );

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.018, 8, 16),
    material(0xf9eee0)
  );

  handle.position.set(0.12, 0.14, 0);
  coffeeCup.add(handle);

  coffeeCup.position.set(0.8, 1.25, 0.15);
  scene.add(coffeeCup);

  ui.status.textContent = "Drink ready — serve the customer!";
  notify(currentOrder.name + " prepared! Serve it to your customer.");
}

function serveCustomer() {
  if (!currentCustomer || !currentOrder || !preparedDrink) return;

 const revenueMultiplier =
  (upgrades.betterMachine ? 1.10 : 1) *
  (upgrades.premiumBeans ? 1.20 : 1);

const revenue = currentOrder.price * revenueMultiplier;

const baseTip = customerWait > 20 ? currentOrder.tip : 0;
const tip = upgrades.betterTips ? baseTip * 1.5 : baseTip;

  // Update the player's balance
  cash += revenue + tip;

  // Update today's statistics
  served += 1;
  dailySales += revenue;
  dailyTips += tip;

  // Update lifetime statistics
  totalCustomersServed += 1;

  // Save the player's progress
  saveGame();

  // Update the HUD immediately
  ui.cash.textContent = "$" + cash.toFixed(2);
  ui.served.textContent = served;

  notify(
    "Order complete! +$" + revenue +
    (tip ? " + $" + tip + " tip!" : "")
  );

  removeCustomer();
}

// ---------- Player interaction ----------

function canInteract() {
  if (!active || paused || gameOver) return false;

  const dx = camera.position.x - 0.8;
  const dz = camera.position.z - 0.1;

  return Math.sqrt(dx * dx + dz * dz) < INTERACTION_DISTANCE;
}

function interact() {
  if (!canInteract()) {
    notify("Move closer to the counter.");
    return;
  }

  if (!currentCustomer) {
    notify("There are no customers to serve right now.");
    return;
  }

  if (!preparedDrink) {
    prepareDrink();
  } else {
    serveCustomer();
  }
}

function updateInteractionPrompt() {
  promptVisible = canInteract() && !!currentCustomer;

  ui.interaction.classList.toggle("visible", promptVisible);

  if (promptVisible) {
    ui.interactionText.textContent = preparedDrink
      ? "Serve " + currentOrder.name
      : "Prepare " + currentOrder.name;
  }
}

// ---------- Toast notifications ----------

function notify(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  toastTimer = 2.8;
}

// ---------- Movement and collision ----------

function movePlayer(delta) {
  if (!active || paused || gameOver) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(forward, camera.up)
    .normalize();

  const direction = new THREE.Vector3();

  if (keys.KeyW || keys.ArrowUp) direction.add(forward);
  if (keys.KeyS || keys.ArrowDown) direction.sub(forward);
  if (keys.KeyD || keys.ArrowRight) direction.add(right);
  if (keys.KeyA || keys.ArrowLeft) direction.sub(right);

  if (direction.lengthSq() === 0) return;

  direction.normalize();

  const speed = PLAYER_SPEED * delta;

  const nextX = camera.position.x + direction.x * speed;
  const nextZ = camera.position.z + direction.z * speed;

  // Keep the player inside the café
  const clampedX = THREE.MathUtils.clamp(nextX, -5.45, 5.45);
  const clampedZ = THREE.MathUtils.clamp(nextZ, -6.4, 6.35);

  // Counter collision: block movement through the counter
  const insideCounter =
    Math.abs(clampedX) < 2.55 &&
    clampedZ > -0.65 &&
    clampedZ < 0.85;

  if (!insideCounter) {
    camera.position.x = clampedX;
    camera.position.z = clampedZ;
  } else {
    // Allow sliding along the edge of the counter
    camera.position.x = clampedX;
  }

  camera.position.y = PLAYER_HEIGHT;
}

// ---------- Day cycle ----------

function updateGame(delta) {
  if (!active || paused || gameOver) return;

  dayTime -= delta;

  if (currentCustomer) {
    customerWait -= delta;

    if (customerWait <= 0) {
      notify("Customer left! Try to be quicker next time.");
      removeCustomer();
    } else {
      updatePatience();
    }
  } else {
    nextCustomerIn -= delta;

    if (nextCustomerIn <= 0) {
      newCustomer();
    }
  }

  if (dayTime <= 0) {
    endDay();
  }

  if (toastTimer > 0) {
    toastTimer -= delta;

    if (toastTimer <= 0) {
      ui.toast.classList.remove("visible");
    }
  }
}

function endDay() {
  gameOver = true;
  active = false;

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  ui.summary.textContent =
  "DAY " + dayNumber + " COMPLETE!\n\n" +
  "Customers served today: " + served + "\n" +
  "Total customers served: " + totalCustomersServed + "\n\n" +
  "Sales: $" + dailySales.toFixed(2) + "\n" +
  "Tips: $" + dailyTips.toFixed(2) + "\n" +
  "Total earnings today: $" +
  (dailySales + dailyTips).toFixed(2) + "\n\n" +
  "Final balance: $" + cash.toFixed(2);

  saveGame();

  ui.end.classList.remove("hidden");
  ui.interaction.classList.remove("visible");
}

// ---------- Upgrade shop ----------

function openUpgradeShop() {
  if (!gameOver) return;

  ui.end.classList.add("hidden");
  ui.shop.classList.remove("hidden");

  renderUpgradeShop();
}

function closeUpgradeShop() {
  ui.shop.classList.add("hidden");
  ui.end.classList.remove("hidden");
}

function renderUpgradeShop() {
  ui.upgradeItems.innerHTML = upgradeCatalog.map((upgrade) => {
    const owned = upgrades[upgrade.id];
    const canAfford = cash >= upgrade.price;

    let buttonText = "Buy for $" + upgrade.price;

    if (owned) {
      buttonText = "Purchased";
    } else if (!canAfford) {
      buttonText = "Not enough cash";
    }

    return `
      <div class="upgrade-item">
        <h3>${upgrade.name}</h3>
        <p>${upgrade.description}</p>
        <div class="upgrade-price">$${upgrade.price}</div>
        <button
          data-upgrade="${upgrade.id}"
          ${owned || !canAfford ? "disabled" : ""}
        >
          ${buttonText}
        </button>
      </div>
    `;
  }).join("");
}

function purchaseUpgrade(upgradeId) {
  const upgrade = upgradeCatalog.find(
    (item) => item.id === upgradeId
  );

  if (!upgrade) return;

  if (upgrades[upgradeId]) {
    return;
  }

  if (cash < upgrade.price) {
    return;
  }

  cash -= upgrade.price;
  upgrades[upgradeId] = true;

  saveGame();

  ui.cash.textContent = "$" + cash.toFixed(2);

  ui.summary.textContent = ui.summary.textContent.replace(
  /Final balance: \$[\d.]+/,
  "Final balance: $" + cash.toFixed(2)
);

  renderUpgradeShop();
}

// ---------- Start, pause and restart ----------

function startGame() {
  // Keep the player's saved balance and lifetime progress
  served = 0;
  dailySales = 0;
  dailyTips = 0;

  dayTime = 180;
  customerWait = 0;
  nextCustomerIn = 1;
  toastTimer = 0;

  active = true;
  paused = false;
  gameOver = false;

  camera.position.set(0, PLAYER_HEIGHT, 5.2);
  camera.rotation.set(0, 0, 0);

  ui.cash.textContent = "$" + cash.toFixed(2);
  ui.served.textContent = "0";
  ui.day.textContent = String(dayNumber).padStart(2, "0");
  ui.start.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.end.classList.add("hidden");

  renderer.domElement.requestPointerLock();
  saveGame();
}

function pauseGame() {
  if (!active || gameOver) return;

  paused = true;
  ui.pause.classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  ui.pause.classList.add("hidden");
  renderer.domElement.requestPointerLock();
}

function startNextDay() {
  if (!gameOver) {
    return;
  }

  dayNumber += 1;
  saveGame();
  startGame();
}

ui.startButton.addEventListener("click", startGame);
ui.resumeButton.addEventListener("click", resumeGame);
ui.restartButton.addEventListener("click", startNextDay);

ui.shopButton.addEventListener("click", openUpgradeShop);

ui.closeShopButton.addEventListener("click", closeUpgradeShop);

ui.upgradeItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade]");

  if (!button) return;

  purchaseUpgrade(button.dataset.upgrade);
});

document.addEventListener("pointerlockchange", () => {
  if (
    !document.pointerLockElement &&
    active &&
    !paused &&
    !gameOver
  ) {
    pauseGame();
  }
});

document.addEventListener("mousemove", (event) => {
  if (
    document.pointerLockElement !== renderer.domElement ||
    paused ||
    gameOver
  ) return;

  const sensitivity = 0.002;

  camera.rotation.order = "YXZ";
  camera.rotation.y -= event.movementX * sensitivity;
  camera.rotation.x -= event.movementY * sensitivity;

  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x, -Math.PI / 2.2, Math.PI / 2.2
  );
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    event.code === "KeyE" &&
    !event.repeat &&
    !paused &&
    active
  ) {
    interact();
  }

  if (
    event.code === "Escape" &&
    active &&
    !paused &&
    !gameOver
  ) {
    pauseGame();
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  for (const key in keys) keys[key] = false;
});

// ---------- Resize ----------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Main game loop ----------

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  movePlayer(delta);
  updateGame(delta);
  updateInteractionPrompt();

  renderer.render(scene, camera);
}

// Load saved progress before starting the game
loadGame();

// Display the saved balance
ui.cash.textContent = "$" + cash.toFixed(2);
ui.served.textContent = "0";
ui.day.textContent = String(dayNumber).padStart(2, "0");

// Build everything and launch the render loop
buildCafe();
animate();
