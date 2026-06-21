import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";
import {
  uniform,
  attribute,
  positionLocal,
  normalize,
  sin,
  mix,
  vec3,
  vec4,
  float,
  pass,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

/**
 * WebGPU hero — a "forge" of light.
 *
 *  - Rendered with Three.js WebGPURenderer (TSL node materials). On browsers
 *    without WebGPU it transparently falls back to a WebGL2 backend; if even
 *    that fails, the canvas is hidden and the CSS gradient behind it remains.
 *  - A morphing point-cloud sphere displaced by layered-sine noise in TSL,
 *    colour ramping indigo -> gold.
 *  - Rising ember particles. The whole pass runs through a TSL Bloom node so
 *    the gold points genuinely glow (post-processing).
 *  - Pointer parallax. Respects prefers-reduced-motion.
 */
export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGPURenderer | null = null;
    let raf = 0;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return; // CSS gradient stays visible
      }

      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.set(0, 0, 9);

      const group = new THREE.Group();
      scene.add(group);

      /* ---------- morphing point-cloud sphere (TSL) ---------- */
      const COUNT = 9000;
      const positions = new Float32Array(COUNT * 3);
      const seeds = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const t = i / COUNT;
        const phi = Math.acos(1 - 2 * t);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const r = 3.0;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        seeds[i] = Math.random();
      }
      const sphereGeo = new THREE.BufferGeometry();
      sphereGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      sphereGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

      const uTime = uniform(0);
      const seed = attribute("aSeed");
      const dir = normalize(positionLocal);
      const phase = uTime.add(seed.mul(6.2831));
      // layered sine "noise"
      const n = sin(dir.x.mul(2.86).add(phase))
        .mul(0.5)
        .add(sin(dir.y.mul(3.74).sub(phase.mul(1.1))).mul(0.4))
        .add(sin(dir.z.mul(2.42).add(phase.mul(0.7))).mul(0.5));

      const sphereMat = new THREE.PointsNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      sphereMat.positionNode = positionLocal.add(dir.mul(n).mul(0.55));
      const m = n.mul(0.5).add(0.5).clamp(0, 1);
      const col = mix(vec3(0.17, 0.29, 0.52), vec3(0.95, 0.82, 0.47), m.pow(1.6));
      sphereMat.colorNode = vec4(col, float(0.9));
      sphereMat.size = 2.4;
      sphereMat.sizeAttenuation = true;

      const sphere = new THREE.Points(sphereGeo, sphereMat);
      group.add(sphere);

      /* ---------- rising embers ---------- */
      const EMB = 360;
      const embPos = new Float32Array(EMB * 3);
      const embBase = new Float32Array(EMB * 3);
      const embSpeed = new Float32Array(EMB);
      for (let i = 0; i < EMB; i++) {
        const x = (Math.random() - 0.5) * 16;
        const y = (Math.random() - 0.5) * 12;
        const z = (Math.random() - 0.5) * 6 - 1;
        embPos.set([x, y, z], i * 3);
        embBase.set([x, y, z], i * 3);
        embSpeed[i] = 0.3 + Math.random() * 0.9;
      }
      const embGeo = new THREE.BufferGeometry();
      embGeo.setAttribute("position", new THREE.BufferAttribute(embPos, 3));
      const embMat = new THREE.PointsNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      embMat.colorNode = vec4(0.96, 0.81, 0.43, 0.9);
      embMat.size = 3.2;
      embMat.sizeAttenuation = true;
      const embers = new THREE.Points(embGeo, embMat);
      scene.add(embers);

      await renderer.init();
      if (disposed) return;

      /* ---------- bloom post-processing ---------- */
      const post = new THREE.PostProcessing(renderer);
      const scenePass = pass(scene, camera);
      const bloomPass = bloom(scenePass, 1.05, 0.5, 0.0);
      post.outputNode = scenePass.add(bloomPass);

      /* ---------- interaction ---------- */
      const pointer = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      const onResize = () => {
        if (!renderer) return;
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);
      cleanups.push(() => window.removeEventListener("resize", onResize));

      let visible = true;
      const onVis = () => (visible = document.visibilityState === "visible");
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

      /* ---------- loop ---------- */
      const clock = new THREE.Clock();
      const tick = async () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const dt = clock.getDelta();
        const t = clock.elapsedTime;

        uTime.value = reduce ? 0.4 : t * 0.6;
        if (!reduce) {
          group.rotation.y += dt * 0.12;
          group.rotation.x = Math.sin(t * 0.2) * 0.12;
        }
        camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.04;
        camera.position.y += (-pointer.y * 1.0 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        const arr = embGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < EMB; i++) {
          arr[i * 3 + 1] += embSpeed[i] * dt * (reduce ? 0.2 : 1);
          arr[i * 3] = embBase[i * 3] + Math.sin(t * embSpeed[i] + i) * 0.4;
          if (arr[i * 3 + 1] > 6.5) arr[i * 3 + 1] = -6.5;
        }
        embGeo.attributes.position.needsUpdate = true;

        await post.renderAsync();
      };
      tick();

      cleanups.push(() => {
        sphereGeo.dispose();
        sphereMat.dispose();
        embGeo.dispose();
        embMat.dispose();
      });
    })().catch((err) => {
      console.warn("Hero3D: WebGPU/TSL init failed, showing static background.", err);
      if (renderer?.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
    });

    /* ---------- cleanup ---------- */
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" aria-hidden="true" />;
}
