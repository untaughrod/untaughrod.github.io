/**
 * Hero scene: a procedurally built retro handheld, modelled rather than
 * imported so there is no asset to download and it can be re-coloured from CSS
 * tokens. It nods at the 3D work in the portfolio while proving the engineering
 * side in the same breath.
 *
 * Everything is lazy: the module is only imported once the canvas is near the
 * viewport, the render loop pauses when it scrolls away, and the whole thing
 * is skipped for reduced-motion users.
 */

import * as THREE from 'three';

/** Kept in sync by hand with `--accent` in global.css — WebGL can't read CSS
 *  custom properties. */
const ACCENT = 0xf8ac92;
const ACCENT_RGB = '248, 172, 146';

/** A rounded, bevelled slab — the silhouette every handheld shares. */
function roundedSlab(width: number, height: number, radius: number, depth: number) {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;

  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.09,
    bevelSegments: 5,
    curveSegments: 18,
  });

  geometry.center();
  return geometry;
}

/**
 * The screen contents, drawn to a 2D canvas and uploaded as a texture. Cheaper
 * and far more controllable than a shader for something this small.
 */
function createScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (t: number) => {
    // Warm near-black rather than the old green-tinted ground, so the peach
    // phosphor has something neutral to sit on.
    ctx.fillStyle = '#1a0d09';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Faint grid, like an LCD's pixel lattice.
    ctx.strokeStyle = `rgba(${ACCENT_RGB}, 0.08)`;
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvas.height);
      ctx.stroke();
    }

    // A travelling waveform, quantised to the grid so it reads as low-res.
    const cell = 8;
    ctx.fillStyle = '#f8ac92';
    for (let i = 0; i < canvas.width / cell; i++) {
      const x = i * cell;
      const phase = t * 1.6 + i * 0.28;
      const y = canvas.height / 2 + Math.sin(phase) * 34 + Math.sin(phase * 0.42) * 16;
      const qy = Math.round(y / cell) * cell;

      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, qy, cell - 2, cell - 2);
      // A short comet tail under each head pixel.
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x, qy + cell, cell - 2, cell - 2);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, qy + cell * 2, cell - 2, cell - 2);
    }
    ctx.globalAlpha = 1;

    // Scanline sweep.
    const sweep = ((t * 40) % (canvas.height + 60)) - 30;
    const gradient = ctx.createLinearGradient(0, sweep - 20, 0, sweep + 20);
    gradient.addColorStop(0, `rgba(${ACCENT_RGB}, 0)`);
    gradient.addColorStop(0.5, `rgba(${ACCENT_RGB}, 0.13)`);
    gradient.addColorStop(1, `rgba(${ACCENT_RGB}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, sweep - 20, canvas.width, 40);

    texture.needsUpdate = true;
  };

  draw(0);
  return { texture, draw };
}

export function initHero(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });

  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // --- Lighting -------------------------------------------------------------
  // Intensities below are the dark-mode values; applyTheme() retunes them all.
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0015;
  scene.add(key);

  // Peach rim along the left edge — the brand colour doing structural work.
  // Pulled back from the 3.2 the acid green wanted: #f8ac92 carries far more
  // luminance, and at the old intensity it flattened the shell to pink.
  const rim = new THREE.DirectionalLight(ACCENT, 2.4);
  rim.position.set(-7, 2, -3);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x5577ff, 0.9);
  fill.position.set(-3, -4, 5);
  scene.add(fill);

  // --- The device -----------------------------------------------------------
  const device = new THREE.Group();

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1c22,
    roughness: 0.52,
    metalness: 0.18,
  });

  const body = new THREE.Mesh(roundedSlab(3.5, 5.6, 0.5, 0.5), shellMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  device.add(body);

  // Front face sits at half the extrude depth plus the bevel.
  const FRONT = 0.34;

  const bezel = new THREE.Mesh(
    roundedSlab(2.75, 2.3, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0d0d11, roughness: 0.35, metalness: 0.4 }),
  );
  bezel.position.set(0, 1.15, FRONT);
  device.add(bezel);

  const { texture: screenTexture, draw: drawScreen } = createScreen();
  const screenMaterial = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.85), screenMaterial);
  screen.position.set(0, 1.15, FRONT + 0.055);
  device.add(screen);

  // Screen bloom stand-in: a soft light bleeding onto the shell.
  // Base intensity the render loop oscillates around; applyTheme() moves it.
  let glowBase = 1.9;
  const screenGlow = new THREE.PointLight(ACCENT, glowBase, 5, 2);
  screenGlow.position.set(0, 1.15, FRONT + 0.9);
  device.add(screenGlow);

  // --- Controls -------------------------------------------------------------
  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a33,
    roughness: 0.65,
    metalness: 0.1,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.4,
    metalness: 0.05,
    emissive: ACCENT,
    emissiveIntensity: 0.18,
  });

  // D-pad: two crossed slabs.
  const dpad = new THREE.Group();
  const armH = new THREE.Mesh(roundedSlab(1.0, 0.34, 0.08, 0.12), buttonMaterial);
  const armV = new THREE.Mesh(roundedSlab(0.34, 1.0, 0.08, 0.12), buttonMaterial);
  armH.castShadow = true;
  armV.castShadow = true;
  dpad.add(armH, armV);
  dpad.position.set(-0.92, -1.15, FRONT + 0.06);
  device.add(dpad);

  // Action buttons, angled the way they always are.
  const pill = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 28);
  [
    { x: 1.18, y: -1.42, material: accentMaterial },
    { x: 0.6, y: -1.02, material: accentMaterial },
  ].forEach(({ x, y, material }) => {
    const button = new THREE.Mesh(pill, material);
    button.rotation.x = Math.PI / 2;
    button.position.set(x, y, FRONT + 0.06);
    button.castShadow = true;
    device.add(button);
  });

  // Start / select.
  const stub = roundedSlab(0.5, 0.15, 0.07, 0.08);
  [-0.36, 0.36].forEach((x) => {
    const key = new THREE.Mesh(stub, buttonMaterial);
    key.position.set(x, -2.15, FRONT + 0.04);
    key.rotation.z = -0.18;
    device.add(key);
  });

  // Speaker grille.
  const holeGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12);
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.9 });
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const hole = new THREE.Mesh(holeGeometry, holeMaterial);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(1.05 + col * 0.16 - row * 0.055, -2.28 - row * 0.16, FRONT + 0.01);
      device.add(hole);
    }
  }

  // Resting attitude: a three-quarter view reads as an object, not a diagram.
  device.rotation.set(-0.12, -0.38, 0.06);
  scene.add(device);

  // --- Theme ----------------------------------------------------------------
  /**
   * The scene was lit for a dark page: a low ambient with the shell reading
   * against near-black, and an emissive screen doing glow work. None of that
   * survives a move to off-white — the glow has nothing to bloom against, and
   * the shell collapses into a silhouette.
   *
   * The device deliberately stays dark in both modes. A dark object reads as an
   * object on either ground; recolouring it per theme would cost the model its
   * identity. Only the light rig changes.
   */
  const applyTheme = (theme: string) => {
    const light = theme === 'light';

    // Bounce: a light room fills shadows that a dark one leaves black.
    ambient.intensity = light ? 0.95 : 0.35;
    key.intensity = light ? 1.8 : 2.4;
    // Rim and glow are contrast effects. Against white they stop reading as
    // light and start reading as smudge, so they are pulled well back.
    rim.intensity = light ? 1.1 : 2.4;
    fill.intensity = light ? 0.45 : 0.9;
    screenMaterial.emissiveIntensity = light ? 0.5 : 0.85;
    glowBase = light ? 0.7 : 1.9;
  };

  const onThemeChange = (event: Event) => {
    applyTheme((event as CustomEvent<{ theme: string }>).detail.theme);
  };
  document.addEventListener('themechange', onThemeChange);

  applyTheme(
    document.documentElement.dataset.theme ??
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  );

  // --- Interaction ----------------------------------------------------------
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let scrollProgress = 0;

  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const onScroll = () => {
    // 0 at the top of the page, 1 once the hero has fully passed.
    scrollProgress = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Sizing ---------------------------------------------------------------
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w === 0 || h === 0) return;

    // Cap DPR: past 2 the extra pixels cost real frames and buy nothing.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;

    // Pull back on narrow viewports so the device never crops.
    camera.position.z = w / h < 0.9 ? 15 : 11;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // --- Loop -----------------------------------------------------------------
  const clock = new THREE.Clock();
  let frame = 0;

  // Two independent reasons to stop drawing. Tracked separately so that tabbing
  // back to a page scrolled past the hero doesn't restart the loop.
  let onScreen = true;
  let tabVisible = !document.hidden;

  const render = () => {
    frame = requestAnimationFrame(render);
    if (!onScreen || !tabVisible) return;

    const t = clock.getElapsedTime();

    // Smooth the pointer so fast flicks don't snap the model around.
    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;

    device.rotation.y = -0.38 + eased.x * 0.45 + Math.sin(t * 0.32) * 0.07;
    device.rotation.x = -0.12 + eased.y * 0.28 + Math.cos(t * 0.27) * 0.05;

    // Idle bob, plus a scroll-linked drift down and away.
    device.position.y = Math.sin(t * 0.6) * 0.12 - scrollProgress * 2.2;
    device.position.z = -scrollProgress * 4;
    device.rotation.z = 0.06 + scrollProgress * 0.5;

    screenGlow.intensity = glowBase + Math.sin(t * 2.4) * 0.3;

    drawScreen(t);
    renderer.render(scene, camera);
  };

  render();

  // Stop rendering entirely when the hero is off-screen.
  const visibility = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
    },
    { threshold: 0 },
  );
  visibility.observe(canvas);

  const onVisibilityChange = () => {
    tabVisible = !document.hidden;
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('themechange', onThemeChange);
    resizeObserver.disconnect();
    visibility.disconnect();

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    screenTexture.dispose();
    renderer.dispose();
  };
}
