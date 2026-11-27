import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  CameraPreset,
  CapturedPoint,
  CapturedStrokeRecord,
  HanziCharacter,
  LiveCaptureTelemetry,
  StageDisplayMode,
} from '../types/hanzi';
import {
  buildCalligraphyBrushGroup,
  buildCalligraphyDeskGroup,
  buildCharacterStrokes3D,
  buildVariablePressureStrokeGeometry,
  BuiltStroke3D,
  PAPER_Y,
  tianzigeToWorld,
} from '../three/hanzi3DBuilders';
import { getPressureLabel } from '../utils/strokeCaptureEngine';

interface Hanzi3DStageProps {
  character: HanziCharacter;
  stageMode: StageDisplayMode;
  onStageModeChange: (mode: StageDisplayMode) => void;
  capturedStrokes: CapturedStrokeRecord[];
  liveStrokePoints: CapturedPoint[];
  liveTelemetry: LiveCaptureTelemetry | null;
  externalActiveStrokeIndex?: number | null;
  onStrokeStepChange?: (strokeIndex: number) => void;
}

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  isometric: { pos: [0.25, 7.2, 7.1], target: [0, -0.2, 0.55], label: '立体斜角' },
  top: { pos: [0, 9.2, 0.8], target: [0, 0, 0.35], label: '正视俯瞰' },
  closeup: { pos: [3.1, 3.6, 4.0], target: [0, 0.2, 0.15], label: '笔尖特写' },
};

const _scratchPos = new THREE.Vector3();
const _scratchTan = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const Hanzi3DStage: React.FC<Hanzi3DStageProps> = ({
  character,
  stageMode,
  onStageModeChange,
  capturedStrokes,
  liveStrokePoints,
  liveTelemetry,
  externalActiveStrokeIndex,
  onStrokeStepChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1.0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [showAirArcs, setShowAirArcs] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [currentStrokeIdx, setCurrentStrokeIdx] = useState(0);
  const [webglFallback, setWebglFallback] = useState(false);

  // Store mutable refs so WebGLRenderer mounts ONCE and never resets on React state changes
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const showAirArcsRef = useRef(showAirArcs);
  const stageModeRef = useRef(stageMode);
  const onStrokeStepChangeRef = useRef(onStrokeStepChange);
  const characterRef = useRef(character);

  isPlayingRef.current = isPlaying;
  speedRef.current = speed;
  showAirArcsRef.current = showAirArcs;
  stageModeRef.current = stageMode;
  onStrokeStepChangeRef.current = onStrokeStepChange;
  characterRef.current = character;

  const controllerRef = useRef<{
    loadCharacter: (char: HanziCharacter) => void;
    jumpToStroke: (idx: number) => void;
    replay: () => void;
    setPreset: (preset: CameraPreset) => void;
    setShowArcs: (show: boolean) => void;
    syncStageMode: (mode: StageDisplayMode) => void;
    syncCapturedStrokes: (records: CapturedStrokeRecord[]) => void;
    syncLiveStroke: (points: CapturedPoint[], telemetry: LiveCaptureTelemetry | null) => void;
    wake: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const handleContextRestored = () => {
      setWebglFallback(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 14, 30);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    camera.position.set(...CAMERA_PRESETS.isometric.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.isometric.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 3.2;
    controls.maxDistance = 12.5;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.update();

    const hemiLight = new THREE.HemisphereLight(0xe0eeff, 0x94a3b8, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.55);
    keyLight.position.set(5.5, 9.5, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -6.5;
    keyLight.shadow.camera.right = 6.5;
    keyLight.shadow.camera.top = 6.5;
    keyLight.shadow.camera.bottom = -6.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc7dcf7, 0.65);
    rimLight.position.set(-6, 5.5, -5.5);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const desk = buildCalligraphyDeskGroup(maxAniso);
    scene.add(desk.group);

    const brush = buildCalligraphyBrushGroup();
    scene.add(brush.group);

    // 1. Canonical Demo Stroke Group
    let charGroup: THREE.Group | null = null;
    let builtStrokes: BuiltStroke3D[] = [];
    let strokeDisposables: Array<{ dispose: () => void }> = [];

    // 2. Live Variable-Pressure User Capture Group (completed strokes + live stroke + soft beacon)
    const userCaptureGroup = new THREE.Group();
    scene.add(userCaptureGroup);

    const userCompletedGroup = new THREE.Group();
    userCaptureGroup.add(userCompletedGroup);
    let userCompletedGeos: THREE.BufferGeometry[] = [];

    const userInkMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const liveInkMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
    });

    let liveStrokeMesh: THREE.Mesh | null = null;

    // Gentle 3D soft guide beacon showing where the standard track is when deviating
    const beaconGeo = new THREE.RingGeometry(0.14, 0.24, 24);
    beaconGeo.rotateX(-Math.PI / 2);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const deviationBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    deviationBeacon.visible = false;
    userCaptureGroup.add(deviationBeacon);

    // Animation timeline state for Demo mode
    let activeIdx = 0;
    let phase: 'transfer' | 'write' | 'pause_end' = 'write';
    let phaseProgress = 0;
    let lastNotifiedIdx = -1;

    // Camera transition state
    let camTransitionActive = false;
    _targetCamPos.set(...CAMERA_PRESETS.isometric.pos);
    _targetLook.set(...CAMERA_PRESETS.isometric.target);

    const cancelCamTransition = () => {
      camTransitionActive = false;
    };
    controls.addEventListener('start', cancelCamTransition);

    const disposeCurrentCharacter = () => {
      if (charGroup) {
        scene.remove(charGroup);
        charGroup = null;
      }
      for (const d of strokeDisposables) {
        d.dispose();
      }
      strokeDisposables = [];
      builtStrokes = [];
    };

    const disposeUserCompleted = () => {
      while (userCompletedGroup.children.length > 0) {
        userCompletedGroup.remove(userCompletedGroup.children[0]);
      }
      for (const g of userCompletedGeos) g.dispose();
      userCompletedGeos = [];
    };

    const disposeLiveStroke = () => {
      if (liveStrokeMesh) {
        userCaptureGroup.remove(liveStrokeMesh);
        liveStrokeMesh.geometry.dispose();
        liveStrokeMesh = null;
      }
    };

    const applyModeVisibility = () => {
      const isLive = stageModeRef.current === 'live_capture';
      userCaptureGroup.visible = isLive;

      // In live_capture mode, keep faint paper guide silhouettes visible, hide canonical demo ink tubes
      for (const s of builtStrokes) {
        s.inkMesh.visible = !isLive;
        s.guideMesh.visible = true;
        if (isLive) {
          s.startCap.visible = false;
          s.endCap.visible = false;
          if (s.airArcMesh) s.airArcMesh.visible = false;
        }
      }
    };

    const updateStrokeVisuals = () => {
      applyModeVisibility();
      if (stageModeRef.current === 'live_capture') return;

      const count = builtStrokes.length;
      if (count === 0) return;

      for (let i = 0; i < count; i++) {
        const s = builtStrokes[i];
        const totalIndices = s.tubularSegments * s.radialSegments * 6;
        const mat = s.inkMesh.material as THREE.MeshPhysicalMaterial;

        if (i < activeIdx) {
          s.inkMesh.geometry.setDrawRange(0, totalIndices);
          mat.color.setHex(0x16202e);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          s.startCap.visible = true;
          s.endCap.visible = true;
          if (s.airArcMesh) s.airArcMesh.visible = showAirArcsRef.current;
        } else if (i === activeIdx) {
          if (phase === 'transfer') {
            s.inkMesh.geometry.setDrawRange(0, 0);
            s.startCap.visible = false;
            s.endCap.visible = false;
            if (s.airArcMesh) s.airArcMesh.visible = showAirArcsRef.current;
          } else if (phase === 'pause_end') {
            s.inkMesh.geometry.setDrawRange(0, totalIndices);
            mat.color.setHex(0x16202e);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
            s.startCap.visible = true;
            s.endCap.visible = true;
            if (s.airArcMesh) s.airArcMesh.visible = showAirArcsRef.current;
          } else {
            const segs = Math.max(1, Math.floor(phaseProgress * s.tubularSegments));
            s.inkMesh.geometry.setDrawRange(0, segs * s.radialSegments * 6);
            mat.color.setHex(0xd93829);
            mat.emissive.setHex(0x991b1b);
            mat.emissiveIntensity = 0.22;
            s.startCap.visible = phaseProgress > 0.02;
            s.endCap.visible = phaseProgress >= 0.98;
            if (s.airArcMesh) s.airArcMesh.visible = showAirArcsRef.current;
          }
        } else {
          s.inkMesh.geometry.setDrawRange(0, 0);
          s.startCap.visible = false;
          s.endCap.visible = false;
          if (s.airArcMesh) s.airArcMesh.visible = false;
        }
      }

      const current = builtStrokes[Math.min(activeIdx, count - 1)];
      if (!current) return;

      if (phase === 'transfer' && current.airArcCurve) {
        current.airArcCurve.getPoint(THREE.MathUtils.clamp(phaseProgress, 0, 1), _scratchPos);
        brush.group.position.copy(_scratchPos);
        brush.group.rotation.set(0.24, 0, -0.22);
        brush.tipMaterial.emissiveIntensity = 0.15;
      } else if (phase === 'write') {
        const t = THREE.MathUtils.clamp(phaseProgress, 0, 1);
        current.curve.getPoint(t, _scratchPos);
        current.curve.getTangent(t, _scratchTan);
        brush.group.position.set(_scratchPos.x, _scratchPos.y + 0.015, _scratchPos.z);
        brush.group.rotation.set(
          0.14 + _scratchTan.z * 0.12,
          0,
          -0.16 - _scratchTan.x * 0.12,
        );
        brush.tipMaterial.emissiveIntensity = 0.55;
      } else {
        current.curve.getPoint(1, _scratchPos);
        const lift = 0.48 + Math.sin(phaseProgress * Math.PI) * 0.18;
        brush.group.position.set(_scratchPos.x, _scratchPos.y + lift, _scratchPos.z);
        brush.group.rotation.set(0.2, 0, -0.2);
        brush.tipMaterial.emissiveIntensity = 0.2;
      }

      if (activeIdx !== lastNotifiedIdx) {
        lastNotifiedIdx = activeIdx;
        setCurrentStrokeIdx(activeIdx);
        onStrokeStepChangeRef.current?.(activeIdx);
      }
    };

    const loadCharacter = (char: HanziCharacter) => {
      disposeCurrentCharacter();
      const built = buildCharacterStrokes3D(char.strokes);
      charGroup = built.group;
      builtStrokes = built.builtStrokes;
      strokeDisposables = built.disposables;
      scene.add(charGroup);

      activeIdx = 0;
      phase = 'write';
      phaseProgress = 0.35;
      lastNotifiedIdx = -1;
      updateStrokeVisuals();
      requestRender();
    };

    // Rendering scheduler: on-demand coalescing + software-WebGL afterDraw pacing
    let frameId = 0;
    let destroyed = false;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      if (destroyed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (destroyed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepSimulation(dt: number) {
      if (camTransitionActive) {
        const lambda = 7.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, lambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, lambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, lambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, lambda, dt);
        if (
          camera.position.distanceTo(_targetCamPos) < 0.025 &&
          controls.target.distanceTo(_targetLook) < 0.025
        ) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetLook);
          camTransitionActive = false;
        }
      }

      if (stageModeRef.current === 'demo' && isPlayingRef.current && builtStrokes.length > 0) {
        const spd = speedRef.current;
        if (phase === 'write') {
          phaseProgress += dt * 0.92 * spd;
          if (phaseProgress >= 1) {
            phaseProgress = 1;
            if (activeIdx + 1 < builtStrokes.length) {
              activeIdx += 1;
              phase = 'transfer';
              phaseProgress = 0;
            } else {
              phase = 'pause_end';
              phaseProgress = 0;
            }
          }
        } else if (phase === 'transfer') {
          phaseProgress += dt * 1.45 * spd;
          if (phaseProgress >= 1) {
            phase = 'write';
            phaseProgress = 0;
          }
        } else {
          phaseProgress += dt * 0.72 * spd;
          if (phaseProgress >= 1) {
            activeIdx = 0;
            phase = 'write';
            phaseProgress = 0;
          }
        }
        updateStrokeVisuals();
      }
    }

    function requestRender() {
      if (destroyed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;

      frameId = requestAnimationFrame(() => {
        if (destroyed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.12, Math.max(0.004, (now - lastTime) / 1000));
        lastTime = now;

        stepSimulation(dt);
        controls.update();
        renderer.render(scene, camera);

        const shouldContinue =
          (stageModeRef.current === 'demo' && isPlayingRef.current) || camTransitionActive;
        const done = () => {
          renderBusy = false;
          if (destroyed) return;
          if (renderDirty || shouldContinue) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);

    loadCharacter(characterRef.current);
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (destroyed || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 10 || h < 10) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    controllerRef.current = {
      loadCharacter,
      jumpToStroke: (idx: number) => {
        if (builtStrokes.length === 0) return;
        activeIdx = Math.max(0, Math.min(builtStrokes.length - 1, idx));
        phase = 'write';
        phaseProgress = 1;
        updateStrokeVisuals();
        requestRender();
      },
      replay: () => {
        activeIdx = 0;
        phase = 'write';
        phaseProgress = 0;
        lastNotifiedIdx = -1;
        updateStrokeVisuals();
        lastTime = performance.now();
        requestRender();
      },
      setPreset: (preset: CameraPreset) => {
        const cfg = CAMERA_PRESETS[preset];
        _targetCamPos.set(...cfg.pos);
        _targetLook.set(...cfg.target);
        camTransitionActive = true;
        lastTime = performance.now();
        requestRender();
      },
      setShowArcs: (show: boolean) => {
        showAirArcsRef.current = show;
        updateStrokeVisuals();
        requestRender();
      },
      syncStageMode: (mode: StageDisplayMode) => {
        stageModeRef.current = mode;
        applyModeVisibility();
        if (mode === 'demo') {
          updateStrokeVisuals();
          lastTime = performance.now();
        } else {
          // Hover brush gently off to side until user touches paper
          brush.group.position.set(1.8, PAPER_Y + 0.65, 1.5);
          brush.group.rotation.set(0.2, 0, -0.2);
        }
        requestRender();
      },
      syncCapturedStrokes: (records: CapturedStrokeRecord[]) => {
        disposeUserCompleted();
        for (const rec of records) {
          const geo = buildVariablePressureStrokeGeometry(rec.points, { isDeviating: false });
          if (geo) {
            const mesh = new THREE.Mesh(geo, userInkMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            userCompletedGroup.add(mesh);
            userCompletedGeos.push(geo);
          }
        }
        requestRender();
      },
      syncLiveStroke: (points: CapturedPoint[], telemetry: LiveCaptureTelemetry | null) => {
        disposeLiveStroke();

        const isDeviating =
          telemetry?.status === 'drifting' ||
          telemetry?.status === 'off_track' ||
          telemetry?.status === 'wrong_order' ||
          telemetry?.status === 'reverse_direction';

        if (points.length >= 2) {
          const geo = buildVariablePressureStrokeGeometry(points, { isDeviating });
          if (geo) {
            liveStrokeMesh = new THREE.Mesh(geo, liveInkMat);
            liveStrokeMesh.castShadow = true;
            userCaptureGroup.add(liveStrokeMesh);
          }
        }

        if (stageModeRef.current === 'live_capture') {
          if (points.length >= 1) {
            const last = points[points.length - 1];
            const worldPt = tianzigeToWorld(last, PAPER_Y + 0.02);
            // Deeper brush dip for heavier pressure, gentler skim for lighter pressure
            const pressDepth = (1 - last.pressure) * 0.14;
            brush.group.position.set(worldPt.x, PAPER_Y + 0.03 + pressDepth, worldPt.z);
            brush.group.rotation.set(0.12 + last.pressure * 0.08, 0, -0.15 - last.pressure * 0.08);
            brush.tipMaterial.color.setHex(isDeviating ? 0xd97706 : 0xd93829);
            brush.tipMaterial.emissive.setHex(isDeviating ? 0xd97706 : 0xd93829);
            brush.tipMaterial.emissiveIntensity = 0.25 + last.pressure * 0.55;
          } else {
            // Gently hover brush when lifted
            brush.group.position.y = Math.max(brush.group.position.y, PAPER_Y + 0.52);
            brush.tipMaterial.emissiveIntensity = 0.18;
          }

          if (isDeviating && telemetry?.nearestTrackPoint) {
            const targetWorld = tianzigeToWorld(telemetry.nearestTrackPoint, PAPER_Y + 0.035);
            deviationBeacon.position.copy(targetWorld);
            deviationBeacon.visible = true;
          } else {
            deviationBeacon.visible = false;
          }
        }

        requestRender();
      },
      wake: () => {
        lastTime = performance.now();
        requestRender();
      },
    };

    return () => {
      destroyed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', cancelCamTransition);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      disposeCurrentCharacter();
      disposeUserCompleted();
      disposeLiveStroke();
      userInkMat.dispose();
      liveInkMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      for (const d of desk.disposables) d.dispose();
      for (const d of brush.disposables) d.dispose();
      envRT.dispose();
      renderer.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setCurrentStrokeIdx(0);
    setIsPlaying(true);
    controllerRef.current?.loadCharacter(character);
  }, [character]);

  useEffect(() => {
    controllerRef.current?.syncStageMode(stageMode);
  }, [stageMode]);

  useEffect(() => {
    controllerRef.current?.syncCapturedStrokes(capturedStrokes);
  }, [capturedStrokes]);

  useEffect(() => {
    controllerRef.current?.syncLiveStroke(liveStrokePoints, liveTelemetry);
  }, [liveStrokePoints, liveTelemetry]);

  useEffect(() => {
    if (typeof externalActiveStrokeIndex === 'number' && externalActiveStrokeIndex >= 0) {
      setIsPlaying(false);
      controllerRef.current?.jumpToStroke(externalActiveStrokeIndex);
    }
  }, [externalActiveStrokeIndex]);

  const handleTogglePlay = () => {
    if (stageMode !== 'demo') onStageModeChange('demo');
    setIsPlaying((prev) => {
      const next = !prev;
      isPlayingRef.current = next;
      if (next) controllerRef.current?.wake();
      return next;
    });
  };

  const handleStep = (delta: number) => {
    if (stageMode !== 'demo') onStageModeChange('demo');
    setIsPlaying(false);
    isPlayingRef.current = false;
    const nextIdx = Math.max(0, Math.min(character.strokes.length - 1, currentStrokeIdx + delta));
    controllerRef.current?.jumpToStroke(nextIdx);
  };

  const handleReplay = () => {
    if (stageMode !== 'demo') onStageModeChange('demo');
    setIsPlaying(true);
    isPlayingRef.current = true;
    controllerRef.current?.replay();
  };

  const handlePreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    controllerRef.current?.setPreset(preset);
  };

  const handleToggleArcs = () => {
    setShowAirArcs((prev) => {
      const next = !prev;
      controllerRef.current?.setShowArcs(next);
      return next;
    });
  };

  const activeStroke = character.strokes[currentStrokeIdx] ?? character.strokes[0];
  const livePressurePct = liveTelemetry ? Math.round(liveTelemetry.pressure * 100) : 55;

  return (
    <div
      className="relative w-full h-[460px] lg:h-[520px] rounded-xl overflow-hidden bg-[#F1F5F9] border border-slate-200 select-none"
      data-testid="hanzi-3d-stage"
      data-stage-mode={stageMode}
      data-playing={isPlaying ? 'true' : 'false'}
      data-stroke-index={currentStrokeIdx}
      data-captured-count={capturedStrokes.length}
    >
      {!webglFallback ? (
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-100 text-slate-700">
          <span className="font-hanzi text-7xl text-slate-800 mb-3">{character.char}</span>
          <p className="text-sm font-medium">3D 视图当前未启用，可使用右侧田字格临摹练习</p>
        </div>
      )}

      {/* Minimal Top-Left Readout & Demo/Live Mode Switcher (solid white surface, no backdrop-blur) */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 border border-slate-200 rounded-lg px-3.5 py-2 shadow-sm pointer-events-auto">
          {stageMode === 'demo' ? (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-800">3D 示范运笔</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-[#D93829] font-semibold">
                  第 {currentStrokeIdx + 1}/{character.strokes.length} 笔
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-800">{activeStroke?.name}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-[280px] truncate">
                {activeStroke?.directionTip}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-900">3D 压感笔迹同步</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-[#1E3A5F] font-semibold">
                  笔压 {liveTelemetry ? getPressureLabel(liveTelemetry.pressureLevel) : '适中'} ({livePressurePct}%)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-[300px] truncate">
                {capturedStrokes.length > 0 || liveStrokePoints.length > 0
                  ? `已立体雕塑 ${capturedStrokes.length} 笔 · 拖动视角可观察笔迹粗细与墨层立体起伏`
                  : '在右侧田字格落笔，即可在 3D 宣纸上实时呈现压感笔迹粗细'}
              </p>
            </>
          )}
        </div>

        {/* Clean segmented toggle between 3D Demo and Live Pressure Capture */}
        <div
          className="bg-white/95 border border-slate-200 p-0.5 rounded-lg shadow-sm flex items-center gap-0.5 pointer-events-auto"
          role="tablist"
          aria-label="3D展示模式"
        >
          <button
            type="button"
            role="tab"
            aria-selected={stageMode === 'demo'}
            onClick={() => onStageModeChange('demo')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              stageMode === 'demo'
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3D 示范
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={stageMode === 'live_capture'}
            onClick={() => onStageModeChange('live_capture')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              stageMode === 'live_capture'
                ? 'bg-[#D93829] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            实时压感笔迹
          </button>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero viewport occlusion) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[96%]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? '展开3D控制栏' : '收起3D控制栏'}
          className="mb-1.5 inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white/95 border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>展开控制</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>收起控制</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="bg-white/95 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-md flex flex-wrap lg:flex-nowrap items-center justify-center gap-1.5">
            {stageMode === 'demo' && (
              <>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    aria-label={isPlaying ? '暂停笔画演示' : '播放笔画演示'}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#D93829] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? '暂停' : '播放'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(-1)}
                    disabled={currentStrokeIdx === 0}
                    aria-label="上一笔"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(1)}
                    disabled={currentStrokeIdx >= character.strokes.length - 1}
                    aria-label="下一笔"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleReplay}
                    aria-label="重播演示"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg" role="group" aria-label="演示速度">
                  {[
                    { val: 0.6, label: '慢速' },
                    { val: 1.0, label: '标准' },
                    { val: 1.5, label: '快速' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSpeed(opt.val)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        speed === opt.val
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
              </>
            )}

            {/* Camera Angle Presets (available in both Demo and Live Pressure Capture) */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg" role="group" aria-label="3D视角">
              {(['isometric', 'top', 'closeup'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraPreset === preset
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {CAMERA_PRESETS[preset].label}
                </button>
              ))}
            </div>

            {stageMode === 'demo' && (
              <button
                type="button"
                onClick={handleToggleArcs}
                aria-pressed={showAirArcs}
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showAirArcs
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {showAirArcs ? <Sparkles className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>运笔线</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
