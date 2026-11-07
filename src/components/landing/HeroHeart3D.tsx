"use client";

import { useEffect, useRef, useState } from "react";
import HeroHeartSvg from "./HeroHeartSvg";

/** Nhịp tim: 1,45s cho một chu kỳ "lub-dub" mạnh. */
const BEAT_PERIOD = 1.45;

type ThreeNS = typeof import("three");

type SceneHandles = {
  dispose: () => void;
};

/**
 * Trái tim 3D dựng bằng WebGL (three.js): khối sứ trắng phồng, giọt máu đỏ
 * lỏng bóng, đường điện tâm đồ phát sáng quét qua và quầng sáng đập theo nhịp.
 *
 * Canvas trong suốt nên nền đỏ + chữ của thẻ hero giữ nguyên hoàn toàn; chỉ
 * phần trung tâm chuyển động. Nếu WebGL không khả dụng, component tự rơi về
 * bản vẽ SVG tĩnh trong `HeroHeartSvg`.
 */
export default function HeroHeart3D() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let handles: SceneHandles | null = null;

    const boot = async () => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return;

      try {
        const THREE = await import("three");
        if (disposed) return;

        handles = buildScene(THREE, canvas, stage, {
          onReady: () => {
            if (!disposed) setReady(true);
          },
          onFail: () => {
            if (!disposed) setFailed(true);
          },
        });
      } catch (error) {
        console.warn("[hero-heart] Không dựng được cảnh WebGL, dùng SVG dự phòng.", error);
        if (!disposed) setFailed(true);
      }
    };

    void boot();

    return () => {
      disposed = true;
      handles?.dispose();
      handles = null;
    };
  }, []);

  const showSvg = !ready || failed;

  return (
    <div
      ref={stageRef}
      className="hero-heart-stage relative mx-auto my-5 grid size-64 place-items-center sm:size-80"
    >
      {/* Quầng sáng + hào quang xoay chậm tạo chiều sâu cho khối tim. */}
      <div
        aria-hidden
        className="hero-heart-glow absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.45)_0%,rgba(255,228,230,0.24)_36%,transparent_70%)] blur-2xl"
      />
      <div aria-hidden className="hero-heart-aura absolute inset-6 rounded-full opacity-70" />

      {showSvg ? (
        <>
          {/* Các vòng sáng lan ra theo nhịp tim (chỉ dùng cho bản dự phòng). */}
          <div aria-hidden className="absolute inset-0 rounded-full border border-white/15" />
          <div aria-hidden className="absolute inset-7 rounded-full border border-white/10" />
          <div
            aria-hidden
            className="hero-heart-ring absolute inset-2 rounded-full border border-white/30"
          />
          <div
            aria-hidden
            className="hero-heart-ring hero-heart-ring-delay absolute inset-2 rounded-full border border-rose-100/25"
          />

          {/* Bóng đổ mềm bên dưới, co giãn theo nhịp đập. */}
          <div
            aria-hidden
            className="hero-heart-shadow absolute bottom-3 left-1/2 h-6 w-32 -translate-x-1/2 rounded-full bg-rose-950/60 blur-xl sm:w-40"
          />

          <HeroHeartSvg />
        </>
      ) : null}

      <canvas
        ref={canvasRef}
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-1/2 h-[150%] w-[200%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 ${
          ready && !failed ? "opacity-100" : "opacity-0"
        }`}
      />

      <span className="sr-only">
        Trái tim 3D màu trắng đập mạnh theo nhịp tim, bên trong là giọt máu đỏ lỏng
        bóng, phía trước là đường điện tâm đồ phát sáng quét qua.
      </span>
    </div>
  );
}

type BuildCallbacks = {
  onReady: () => void;
  onFail: () => void;
};

function buildScene(
  THREE: ThreeNS,
  canvas: HTMLCanvasElement,
  stage: HTMLDivElement,
  callbacks: BuildCallbacks,
): SceneHandles {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.15, 11.3);

  const root = new THREE.Group();
  scene.add(root);

  /* Không gian phản chiếu: trắng ở trên, đỏ rượu ở dưới → highlight sứ + đỏ. */
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const envCtx = envCanvas.getContext("2d");
  if (envCtx) {
    const gradient = envCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, "#fff4f6");
    gradient.addColorStop(0.47, "#ffc6d0");
    gradient.addColorStop(0.6, "#d81b45");
    gradient.addColorStop(0.78, "#6d0619");
    gradient.addColorStop(1, "#1c0107");
    envCtx.fillStyle = gradient;
    envCtx.fillRect(0, 0, 1024, 512);

    for (const [x, y, r, alpha] of [
      [250, 96, 220, 0.95],
      [720, 130, 170, 0.7],
      [520, 30, 260, 0.55],
      [140, 250, 200, 0.35],
    ] as const) {
      const blob = envCtx.createRadialGradient(x, y, 0, x, y, r);
      blob.addColorStop(0, `rgba(255,255,255,${alpha})`);
      blob.addColorStop(1, "rgba(255,255,255,0)");
      envCtx.fillStyle = blob;
      envCtx.fillRect(0, 0, 1024, 512);
    }
  }

  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(envTexture);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.85;
  envTexture.dispose();
  pmrem.dispose();

  /* Ánh sáng: key trắng ấm, rim hồng đỏ, back light lạnh. */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3d020e, 0.22));

  const keyLight = new THREE.DirectionalLight(0xfff1f3, 2.3);
  keyLight.position.set(4, 5.6, 6);
  scene.add(keyLight);

  const sideRim = new THREE.PointLight(0xffe0e4, 26, 16, 2);
  sideRim.position.set(5.4, 0.4, 2.4);
  scene.add(sideRim);

  const rimLight = new THREE.PointLight(0xff2d52, 46, 20, 2);
  rimLight.position.set(-5.4, 1.6, 3.4);
  scene.add(rimLight);

  const backLight = new THREE.PointLight(0xffffff, 26, 24, 2);
  backLight.position.set(1.5, 2.5, -5.5);
  scene.add(backLight);

  const sparkLight = new THREE.PointLight(0xffffff, 34, 16, 2);
  sparkLight.position.set(-3.2, 3.8, 5.2);
  scene.add(sparkLight);

  const dropSpark = new THREE.PointLight(0xffffff, 7, 8, 2);
  dropSpark.position.set(-1.6, 0.4, 3.8);
  scene.add(dropSpark);


  /* ---------------------------------------------------------------- *
   * Trái tim: mặt phồng hai phía theo dáng lens, viền silhouette là
   * đường cong trái tim → khối 3D tròn đầy thay vì hình extrude phẳng.
   * ---------------------------------------------------------------- */
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -2.2);
  heartShape.bezierCurveTo(-1.45, -1.1, -2.4, -0.15, -2.4, 0.85);
  heartShape.bezierCurveTo(-2.4, 1.65, -1.8, 2.2, -1.05, 2.2);
  heartShape.bezierCurveTo(-0.55, 2.2, -0.175, 1.925, 0, 1.575);
  heartShape.bezierCurveTo(0.175, 1.925, 0.55, 2.2, 1.05, 2.2);
  heartShape.bezierCurveTo(1.8, 2.2, 2.4, 1.65, 2.4, 0.85);
  heartShape.bezierCurveTo(2.4, -0.15, 1.45, -1.1, 0, -2.2);

  const heartGeometry = buildHeartGeometry(THREE, heartShape);
  heartGeometry.scale(0.72, 0.72, 0.72);

  const heartMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xfff4f6,
    roughness: 0.24,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.11,
    sheen: 0.8,
    sheenColor: new THREE.Color(0xffd4da),
    sheenRoughness: 0.5,
    envMapIntensity: 1.05,
    emissive: new THREE.Color(0x1a0104),
    emissiveIntensity: 0.12,
  });

  // Đổ bóng form mềm: tối dần ở rìa và mặt dưới để khối sứ trông có chiều sâu.
  heartMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vEdge;\nvarying float vUp;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 heartNormal = normalize(normalMatrix * normal);
        vEdge = 1.0 - clamp(heartNormal.z, 0.0, 1.0);
        vUp = heartNormal.y;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vEdge;\nvarying float vUp;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.2, 0.95, vEdge));
        diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(-0.8, 0.5, vUp));`,
      );
  };
  heartMaterial.customProgramCacheKey = () => "hero-heart-form-shading";

  const heartMesh = new THREE.Mesh(heartGeometry, heartMaterial);
  heartMesh.position.y = 0.05;
  heartMesh.rotation.z = -0.045;

  const heartGroup = new THREE.Group();
  heartGroup.add(heartMesh);
  root.add(heartGroup);

  /* ---------------------------------------------------------------- *
   * Giọt máu: khối tròn xoay hình giọt, vật liệu ướt bóng, đỉnh hơi
   * rung như chất lỏng.
   * ---------------------------------------------------------------- */
  const dropProfile: Array<[number, number]> = [];
  {
    const height = 1.8;
    const bottom = -0.85;
    for (let i = 0; i <= 44; i += 1) {
      const u = i / 44;
      const radius = 1.45 * Math.pow(u, 0.42) * Math.pow(1 - u, 1.25);
      dropProfile.push([radius, bottom + u * height]);
    }
  }
  const dropPoints = dropProfile.map(([x, y]) => new THREE.Vector2(x, y));
  const dropGeometry = new THREE.LatheGeometry(dropPoints, 72);

  const dropUniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
  };

  const dropMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9a0012,
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    ior: 1.52,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xffb8c4),
    emissive: new THREE.Color(0x5e000e),
    emissiveIntensity: 0.35,
    envMapIntensity: 0.1,
  });
  dropMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = dropUniforms.uTime;
    shader.uniforms.uPulse = dropUniforms.uPulse;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uPulse;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float wobble = sin(position.y * 7.0 + uTime * 3.4) * 0.02
                     + sin(position.x * 9.0 - uTime * 2.6 + position.y * 4.0) * 0.015;
        float belly = smoothstep(-0.9, 0.4, position.y);
        transformed += normal * wobble * (0.55 + belly) * (1.0 + uPulse * 2.6);`,
      );
  };

  const dropMesh = new THREE.Mesh(dropGeometry, dropMaterial);
  dropMesh.position.set(0, -0.42, 0.52);
  dropMesh.scale.setScalar(0.64);

  const dropGroup = new THREE.Group();
  dropGroup.add(dropMesh);
  heartGroup.add(dropGroup);

  /* Điểm sáng bên trong giọt: chất lỏng bóng, trôi nhẹ. */
  const dotTexture = createSoftDotTexture(THREE);
  const socketShadow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture,
      color: 0x6b0012,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  socketShadow.scale.set(1.7, 1.95, 1);
  socketShadow.position.set(0, -0.46, 0.44);
  socketShadow.material.opacity = 0.42;
  heartGroup.add(socketShadow);

  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture,
      color: 0xff3355,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreGlow.scale.set(2.1, 2.4, 1);
  coreGlow.position.set(0, -0.42, 0.46);
  heartGroup.add(coreGlow);

  const liquidGlint = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  liquidGlint.scale.setScalar(0.09);
  liquidGlint.position.set(-0.14, -0.14, 0.8);
  heartGroup.add(liquidGlint);

  const liquidGlintSmall = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture,
      color: 0xffc2cb,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  liquidGlintSmall.scale.setScalar(0.07);
  liquidGlintSmall.position.set(0.15, -0.72, 0.74);
  heartGroup.add(liquidGlintSmall);

  /* ---------------------------------------------------------------- *
   * Đường điện tâm đồ 3D: ống cong theo dạng sóng, đầu sáng chạy dọc.
   * ---------------------------------------------------------------- */
  const ecgGroup = new THREE.Group();
  ecgGroup.position.set(1.0, -0.62, 0.62);
  ecgGroup.rotation.x = -0.1;
  root.add(ecgGroup);

  const ECG_RANGE = 4.0;
  const ECG_STEP = 0.008;
  const ecgCurvePoints: InstanceType<ThreeNS["Vector3"]>[] = [];
  for (let x = -ECG_RANGE; x <= ECG_RANGE; x += ECG_STEP) {
    ecgCurvePoints.push(new THREE.Vector3(x, ecgWaveform(x) * 0.72, 0));
  }
  const ecgCurve = new THREE.CatmullRomCurve3(ecgCurvePoints, false, "catmullrom", 0.08);

  const ecgVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const ecgFrag = `
    varying vec2 vUv;
    uniform float uSweep;
    uniform float uTrail;
    uniform float uGlow;
    uniform float uBase;
    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      float d = vUv.x - uSweep;
      float trail = smoothstep(-uTrail, 0.0, d) * (1.0 - smoothstep(0.0, 0.006, d));
      float head = exp(-pow(d * 120.0, 2.0));
      float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
      float alpha = (uBase + trail * uGlow + head * 1.15) * edge * uOpacity;
      gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
    }
  `;

  const makeEcgMaterial = (
    base: number,
    glow: number,
    opacity: number,
    color: number,
    blending: InstanceType<ThreeNS["ShaderMaterial"]>["blending"],
  ) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uSweep: { value: 0 },
        uTrail: { value: 0.26 },
        uGlow: { value: glow },
        uBase: { value: base },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: ecgVert,
      fragmentShader: ecgFrag,
      transparent: true,
      depthWrite: false,
      blending,
    });

  const ecgBaseMaterial = makeEcgMaterial(0.55, 0, 0.9, 0xd10038, THREE.NormalBlending);
  const ecgSweepMaterial = makeEcgMaterial(0.1, 1, 1, 0xffd9e2, THREE.AdditiveBlending);
  const ecgHaloMaterial = makeEcgMaterial(0.14, 0.75, 0.3, 0xff7d9c, THREE.AdditiveBlending);

  const ecgBase = new THREE.Mesh(new THREE.TubeGeometry(ecgCurve, 900, 0.02, 6, false), ecgBaseMaterial);
  const ecgSweep = new THREE.Mesh(new THREE.TubeGeometry(ecgCurve, 900, 0.019, 8, false), ecgSweepMaterial);
  const ecgHalo = new THREE.Mesh(new THREE.TubeGeometry(ecgCurve, 900, 0.1, 12, false), ecgHaloMaterial);
  ecgGroup.add(ecgBase, ecgSweep, ecgHalo);

  const ecgHead = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture,
      color: 0xfff0f2,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ecgHead.scale.setScalar(0.8);
  ecgGroup.add(ecgHead);

  const ecgHeadLight = new THREE.PointLight(0xffe2e8, 26, 4.2, 2);
  ecgGroup.add(ecgHeadLight);

  /* ---------------------------------------------------------------- *
   * Quầng sáng nền, vòng sáng lan theo nhịp và bóng đổ dưới tim.
   * ---------------------------------------------------------------- */
  const glowTexture = createSoftDotTexture(THREE);

  const backdropGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffe4e8,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  backdropGlow.scale.set(7.6, 7.6, 1);
  backdropGlow.position.set(0, 0.1, -2.6);
  root.add(backdropGlow);

  const ringTexture = createRingTexture(THREE);
  const ringSprites = [0, 0.5].map((offset) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: ringTexture,
        color: 0xffd7dd,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.position.set(0, 0.1, -0.4);
    root.add(sprite);
    return { sprite, offset };
  });

  const shadowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x16000a,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  shadowSprite.scale.set(3.4, 1.05, 1);
  shadowSprite.position.set(0, -1.95, -1.2);
  root.add(shadowSprite);

  /* ---------------------------------------------------------------- *
   * Tương tác chuột: nghiêng nhẹ cả cụm theo con trỏ.
   * ---------------------------------------------------------------- */
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  };

  if (!reducedMotion) {
    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerleave", onPointerLeave);
  }

  /* ---------------------------------------------------------------- *
   * Vòng lặp: mọi chuyển động là hàm của thời gian đã trôi qua.
   * ---------------------------------------------------------------- */
  const beatEnvelope = (time: number) => {
    const phase = (time % BEAT_PERIOD) / BEAT_PERIOD;
    const bump = (center: number, width: number) =>
      Math.exp(-(((phase - center) / width) ** 2));
    return bump(0.05, 0.035) + 0.55 * bump(0.19, 0.048);
  };

  let elapsed = 0;
  let smoothedBeat = 0;
  let laggedBeat = 0;
  let rafId = 0;
  let lastFrame = 0;
  let running = false;
  let visible = true;

  const animate = (now: number) => {
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    const delta = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    elapsed += delta;

    const beat = beatEnvelope(elapsed);
    const ease = 1 - Math.exp(-delta * 26);
    const lagEase = 1 - Math.exp(-delta * 16);
    smoothedBeat += (beat - smoothedBeat) * ease;
    laggedBeat += (smoothedBeat - laggedBeat) * lagEase;

    // Nhịp "lub-dub": giãn nở mạnh về phía người xem.
    heartGroup.scale.set(
      1 + 0.115 * smoothedBeat,
      1 + 0.1 * smoothedBeat,
      1 + 0.27 * smoothedBeat,
    );
    heartGroup.position.y = 0.04 + 0.035 * smoothedBeat;
    heartGroup.rotation.z = -0.045 + 0.012 * smoothedBeat;

    dropGroup.scale.y = 1 + 0.16 * laggedBeat;
    dropGroup.scale.x = 1 - 0.06 * laggedBeat;
    dropGroup.scale.z = 1 - 0.06 * laggedBeat;
    dropGroup.position.y = Math.sin(elapsed * 1.15) * 0.035;
    dropUniforms.uTime.value = elapsed;
    dropUniforms.uPulse.value = laggedBeat;

    liquidGlint.position.x = -0.14 + Math.sin(elapsed * 0.9) * 0.03;
    liquidGlint.position.y = -0.14 + Math.cos(elapsed * 1.25) * 0.04;
    liquidGlint.material.opacity = 0.65 + 0.3 * laggedBeat;
    liquidGlintSmall.position.x = 0.16 + Math.cos(elapsed * 0.7) * 0.04;
    liquidGlintSmall.material.opacity = 0.35 + 0.2 * laggedBeat;

    // Parallax mềm theo con trỏ.
    pointer.x += (pointer.targetX - pointer.x) * (1 - Math.exp(-delta * 4.5));
    pointer.y += (pointer.targetY - pointer.y) * (1 - Math.exp(-delta * 4.5));
    root.rotation.y = pointer.x * 0.16;
    root.rotation.x = pointer.y * 0.08;
    root.position.y = Math.sin(elapsed * 0.8) * 0.03;

    // Quét điện tâm đồ: đầu sáng chạy hết chiều rộng mỗi chu kỳ tim.
    const sweep = (elapsed / BEAT_PERIOD + 0.62) % 1;
    const sweepWithTail = sweep;
    for (const material of [ecgBaseMaterial, ecgSweepMaterial, ecgHaloMaterial]) {
      material.uniforms.uSweep.value = sweepWithTail;
    }
    ecgBaseMaterial.uniforms.uGlow.value = 0;
    const headPoint = ecgCurve.getPointAt(Math.min(0.999, sweepWithTail));
    ecgHead.position.copy(headPoint);
    ecgHead.material.opacity = 0.5 + 0.5 * smoothedBeat;
    ecgHeadLight.position.copy(headPoint);
    ecgHeadLight.intensity = 10 + 10 * smoothedBeat;

    backdropGlow.material.opacity = 0.34 + 0.42 * smoothedBeat;
    backdropGlow.scale.setScalar(7.2 + 1.1 * smoothedBeat);

    for (const { sprite, offset } of ringSprites) {
      const phase = (elapsed / BEAT_PERIOD + offset) % 1;
      const ringScale = 2.1 + phase * 3.1;
      sprite.scale.setScalar(ringScale);
      sprite.material.opacity = Math.max(0, 1 - phase) ** 2 * 0.5 * (0.5 + 0.5 * smoothedBeat);
    }

    shadowSprite.scale.set(3.4 + 0.5 * smoothedBeat, 1.05 + 0.12 * smoothedBeat, 1);
    shadowSprite.material.opacity = 0.3 + 0.2 * smoothedBeat;

    coreGlow.material.opacity = 0.16 + 0.3 * smoothedBeat;
    coreGlow.scale.set(1.9 + 0.35 * smoothedBeat, 2.2 + 0.4 * smoothedBeat, 1);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };

  const renderOnce = (time: number) => {
    elapsed = time;
    const beat = beatEnvelope(time);
    heartGroup.scale.set(1 + 0.115 * beat, 1 + 0.1 * beat, 1 + 0.27 * beat);
    heartGroup.position.y = 0.04 + 0.035 * beat;
    dropGroup.scale.set(1 - 0.06 * beat, 1 + 0.16 * beat, 1 - 0.06 * beat);
    dropUniforms.uTime.value = time;
    dropUniforms.uPulse.value = beat;
    const sweep = (time / BEAT_PERIOD + 0.62) % 1;
    for (const material of [ecgBaseMaterial, ecgSweepMaterial, ecgHaloMaterial]) {
      material.uniforms.uSweep.value = sweep;
    }
    ecgHead.position.copy(ecgCurve.getPointAt(Math.min(0.999, sweep)));
    backdropGlow.material.opacity = 0.48;
    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.6 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!running) renderer.render(scene, camera);
  };

  const start = () => {
    if (running || reducedMotion || !visible || document.hidden) return;
    running = true;
    lastFrame = 0;
    rafId = requestAnimationFrame(animate);
  };

  const stop = () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else start();
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    callbacks.onFail();
  };

  resize();
  renderOnce(0.08);
  callbacks.onReady();

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!running) renderOnce(elapsed);
  });
  resizeObserver.observe(canvas);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    },
    { threshold: 0.05 },
  );
  intersectionObserver.observe(canvas);

  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onContextLost);

  start();

  return {
    dispose: () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);

      scene.traverse((object) => {
        const mesh = object as InstanceType<ThreeNS["Mesh"]>;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as
          | InstanceType<ThreeNS["Material"]>
          | InstanceType<ThreeNS["Material"]>[];
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });

      dotTexture.dispose();
      glowTexture.dispose();
      ringTexture.dispose();
      envTarget.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/** Dạng sóng ECG: P, QRS (nhọn), T trên nền phẳng. */
function ecgWaveform(x: number) {
  const gaussian = (center: number, width: number, amplitude: number) =>
    amplitude * Math.exp(-(((x - center) / width) ** 2));

  return (
    gaussian(-1.18, 0.16, 0.16) +
    gaussian(-0.34, 0.05, -0.24) +
    gaussian(0, 0.03, 1) +
    gaussian(0.15, 0.062, -0.34) +
    gaussian(1.02, 0.33, 0.34)
  );
}

/**
 * Dựng khối tim dạng "lens": mỗi vòng là một đường trái tim thu nhỏ, độ dày
 * z giảm dần từ tâm ra viền, nên mặt trước là một vòm cong liền mạch.
 */
function buildHeartGeometry(THREE: ThreeNS, shape: InstanceType<ThreeNS["Shape"]>) {
  const outline = shape.getPoints(320);
  const palette: Array<{ angle: number; radius: number }> = outline
    .map((point) => ({
      angle: Math.atan2(point.y, point.x),
      radius: Math.hypot(point.x, point.y),
    }))
    .sort((a, b) => a.angle - b.angle);

  const radiusAt = (angle: number) => {
    const twoPi = Math.PI * 2;
    let wrapped = angle;
    while (wrapped < -Math.PI) wrapped += twoPi;
    while (wrapped > Math.PI) wrapped -= twoPi;

    let low = 0;
    let high = palette.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (palette[mid].angle <= wrapped) low = mid;
      else high = mid - 1;
    }
    const a = palette[low];
    const b = palette[(low + 1) % palette.length];
    let span = b.angle - a.angle;
    if (span <= 0) span += twoPi;
    let offset = wrapped - a.angle;
    if (offset < 0) offset += twoPi;
    const ratio = span > 0 ? Math.min(1, offset / span) : 0;
    return a.radius + (b.radius - a.radius) * ratio;
  };

  const RADIAL_SEGMENTS = 200;
  const RING_SEGMENTS = 64;
  const halfThickness = 0.52;
  const positions: number[] = [];

  for (let ring = 0; ring <= RING_SEGMENTS; ring += 1) {
    const v = ring / RING_SEGMENTS;
    const spread = Math.sin(v * Math.PI);
    const z = Math.cos(v * Math.PI) * halfThickness;

    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const angle = (segment / RADIAL_SEGMENTS) * Math.PI * 2;
      const radius = radiusAt(angle) * spread;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    }
  }

  const indices: number[] = [];
  for (let ring = 0; ring < RING_SEGMENTS; ring += 1) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      const a = ring * RADIAL_SEGMENTS + segment;
      const b = ring * RADIAL_SEGMENTS + next;
      const c = (ring + 1) * RADIAL_SEGMENTS + segment;
      const d = (ring + 1) * RADIAL_SEGMENTS + next;
      indices.push(a, d, b, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSoftDotTexture(THREE: ThreeNS) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.28, "rgba(255,255,255,0.72)");
    gradient.addColorStop(0.62, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRingTexture(THREE: ThreeNS) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.78, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
