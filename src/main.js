// =============================================================
// PATH B — Three.js Water Pro
// FFT compute simulation + Gerstner swells + atmospheric sky
// Requires WebGPU (Chrome/Edge 113+; partial Safari).
// =============================================================

import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  WaterSystem,
  RayleighSky,
  getPresetParams,
  PRESETS,
} from "../lib/index.js";

// ---------- WEBGPU DETECTION ----------
async function checkWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}

const loadingEl = document.getElementById("loading");
const fallbackEl = document.getElementById("fallback");

(async function start() {
  const supported = await checkWebGPU();
  if (!supported) {
    loadingEl.classList.add("hidden");
    fallbackEl.classList.add("show");
    return;
  }
  try {
    await main();
    loadingEl.classList.add("hidden");
  } catch (err) {
    console.error("Water Pro init failed:", err);
    loadingEl.classList.add("hidden");
    fallbackEl.classList.add("show");
  }
})();

async function main() {
  // ----- Renderer -----
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  // ----- Scene / Camera -----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );
  camera.position.set(40, 18, 60);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);
  controls.minDistance = 10;
  controls.maxDistance = 800;
  controls.maxPolarAngle = Math.PI * 0.49;

  // ----- Water System -----
  // 'high' is a good default for desktop. Drop to 'medium' or 'low' for perf.
  const water = await WaterSystem.create(renderer, scene, camera, "high");
  let activePresetName = "tropical";
  let preset = getPresetParams(activePresetName);
  water.loadPreset(preset);

  // ----- Sky -----
  let sky = new RayleighSky(preset.sky);
  scene.add(sky.getMesh());
  water.setSky(sky);

  // ----- Lights -----
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  // ----- Post-processing -----
  const postProcessing = new THREE.PostProcessing(renderer);
  const scenePass = pass(water.scene, water.camera);
  let outputNode = scenePass.getTextureNode("output");
  outputNode = water.createPostProcessingNode(scenePass, outputNode);
  outputNode = outputNode.add(bloom(outputNode, 0.4, 0.5, 0.85));
  postProcessing.outputNode = outputNode;

  // ----- Resize -----
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    water.resize();
  });

  // ----- Compile before animating -----
  await renderer.compileAsync(scene, camera);

  // ----- Sliders -----
  buildUI();

  // ----- Animate -----
  const clock = new THREE.Clock();
  let frames = 0, lastFpsTime = performance.now();
  const fpsEl = document.getElementById("fps");

  async function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    controls.update();
    await water.update(dt);
    postProcessing.render();

    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
      fpsEl.textContent = Math.round((frames * 1000) / (now - lastFpsTime));
      frames = 0; lastFpsTime = now;
    }
  }
  animate();

  // -----------------------------------------------------------
  // UI
  // -----------------------------------------------------------
  function buildUI() {
    const slidersEl = document.getElementById("sliders");

    // Preset dropdown — Water Pro's primary "look" knob
    const presetRow = document.createElement("div");
    presetRow.className = "slider-row";
    const presetLabel = document.createElement("div");
    presetLabel.className = "slider-label";
    presetLabel.innerHTML = "<span>Preset</span><span></span>";
    presetRow.appendChild(presetLabel);

    const select = document.createElement("select");
    Object.keys(PRESETS).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === activePresetName) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      activePresetName = select.value;
      preset = getPresetParams(activePresetName);
      water.loadPreset(preset);
      // Rebuild sky from the new preset (Water Pro presets don't auto-apply sky)
      scene.remove(sky.getMesh());
      sky = new RayleighSky(preset.sky);
      scene.add(sky.getMesh());
      water.setSky(sky);
      // Reflect into slider state from the loaded preset values
      syncSlidersFromState();
    });
    presetRow.appendChild(select);
    slidersEl.appendChild(presetRow);

    // Section: Waves
    addSectionLabel(slidersEl, "WAVES");

    const sliderRefs = {};

    sliderRefs.windSpeed = addSlider(
      slidersEl, "Wind speed", 1, 40, 0.1,
      () => water.waves.windSpeed.value,
      (v) => { water.waves.windSpeed.value = v; },
      (v) => v.toFixed(1) + " m/s"
    );
    sliderRefs.amplitude = addSlider(
      slidersEl, "Wave size", 0.05, 1.0, 0.01,
      () => water.waves.amplitude.value,
      (v) => { water.waves.amplitude.value = v; },
      (v) => v.toFixed(2) + "x"
    );
    sliderRefs.choppiness = addSlider(
      slidersEl, "Choppiness", 0.0, 2.0, 0.01,
      () => water.waves.choppiness.value,
      (v) => { water.waves.choppiness.value = v; },
      (v) => v.toFixed(2)
    );
    sliderRefs.animSpeed = addSlider(
      slidersEl, "Speed", 0.0, 6.0, 0.05,
      () => water.waves.animationSpeed,
      (v) => { water.waves.animationSpeed = v; },
      (v) => v.toFixed(2) + "x"
    );

    // Section: Gerstner swells
    addSectionLabel(slidersEl, "SWELLS");

    sliderRefs.gerstAmp = addSlider(
      slidersEl, "Swell height", 0.0, 6.0, 0.05,
      () => water.gerstner.amplitude,
      (v) => { water.gerstner.amplitude = v; },
      (v) => v.toFixed(2)
    );
    sliderRefs.gerstWavelength = addSlider(
      slidersEl, "Swell length", 50, 600, 1,
      () => water.gerstner.wavelength,
      (v) => { water.gerstner.wavelength = v; },
      (v) => Math.round(v) + "m"
    );

    // Section: Sky / Sun
    addSectionLabel(slidersEl, "SKY");

    // Sun position via RayleighSky params — recreate sky on change since
    // Sky params are typically configured at construction. We'll use the
    // params object passed in.
    const skyParams = {
      sunElevation: preset.sky?.sunElevation ?? 30,
      sunAzimuth: preset.sky?.sunAzimuth ?? 180,
      turbidity: preset.sky?.turbidity ?? 4,
    };

    sliderRefs.sunElev = addSlider(
      slidersEl, "Sun elevation", -2, 90, 0.5,
      () => skyParams.sunElevation,
      (v) => { skyParams.sunElevation = v; rebuildSky(); },
      (v) => v.toFixed(1) + "°"
    );
    sliderRefs.sunAz = addSlider(
      slidersEl, "Sun azimuth", 0, 360, 1,
      () => skyParams.sunAzimuth,
      (v) => { skyParams.sunAzimuth = v; rebuildSky(); },
      (v) => Math.round(v) + "°"
    );

    function rebuildSky() {
      try {
        const newSkyParams = {
          ...preset.sky,
          sunElevation: skyParams.sunElevation,
          sunAzimuth: skyParams.sunAzimuth,
          turbidity: skyParams.turbidity,
        };
        scene.remove(sky.getMesh());
        sky = new RayleighSky(newSkyParams);
        scene.add(sky.getMesh());
        water.setSky(sky);
      } catch (e) {
        console.warn("rebuildSky failed:", e);
      }
    }

    function syncSlidersFromState() {
      // Refresh slider visible values to reflect the newly loaded preset
      Object.values(sliderRefs).forEach((ref) => ref.refresh());
      skyParams.sunElevation = preset.sky?.sunElevation ?? 30;
      skyParams.sunAzimuth = preset.sky?.sunAzimuth ?? 180;
      skyParams.turbidity = preset.sky?.turbidity ?? 4;
      sliderRefs.sunElev.refresh();
      sliderRefs.sunAz.refresh();
    }
  }

  function addSectionLabel(parent, text) {
    const el = document.createElement("div");
    el.className = "section-label";
    el.textContent = text;
    parent.appendChild(el);
  }

  function addSlider(parent, label, min, max, step, getter, setter, format) {
    const row = document.createElement("div");
    row.className = "slider-row";
    const labelEl = document.createElement("div");
    labelEl.className = "slider-label";
    const nameEl = document.createElement("span");
    nameEl.textContent = label;
    const valEl = document.createElement("span");
    const initial = clampInRange(getter(), min, max);
    valEl.textContent = format(initial);
    labelEl.append(nameEl, valEl);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = initial;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      setter(v);
      valEl.textContent = format(v);
    });
    row.append(labelEl, input);
    parent.appendChild(row);
    return {
      refresh: () => {
        const v = clampInRange(getter(), min, max);
        input.value = v;
        valEl.textContent = format(v);
      },
    };
  }

  function clampInRange(v, min, max) {
    if (typeof v !== "number" || isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
}

// ---------- PANEL TOGGLE (works regardless of init success) ----------
const panel = document.getElementById("panel");
const hideBtn = document.getElementById("hide-btn");
const showBtn = document.getElementById("show-btn");
function setPanel(visible) {
  panel.classList.toggle("hidden", !visible);
  showBtn.classList.toggle("visible", !visible);
}
hideBtn.addEventListener("click", () => setPanel(false));
showBtn.addEventListener("click", () => setPanel(true));
window.addEventListener("keydown", (e) => {
  if (e.key === "h" || e.key === "H") {
    setPanel(panel.classList.contains("hidden"));
  }
});
