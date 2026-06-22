import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";
import { attribute, vec4, pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

/**
 * WebGPU hero — a global data-linkage network centred on Japan.
 *
 *  - A dim point-cloud globe; Japan sits front-and-centre as the brightest hub.
 *  - Nodes are "born like stars" (staggered twinkling fade-in) across the globe.
 *  - Great-circle arcs link nodes peer-to-peer; light packets travel both ways
 *    along them (trusted, sovereign data exchange).
 *  - Nodes breathe/pulse — utilisation incl. AI compute.
 *  - Rendered with Three.js WebGPURenderer (TSL) + Bloom. Falls back to WebGL2
 *    automatically; if all fails the CSS gradient behind it remains.
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

    const R = 3.0;
    const D2R = Math.PI / 180;
    const latLon = (lat: number, lon: number, r = R) => {
      const phi = (90 - lat) * D2R;
      const theta = lon * D2R;
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    (async () => {
      try {
        // Force the WebGL2 backend: it reliably re-uploads the per-frame
        // animated colour/position buffers across all browsers. (The WebGPU
        // backend did not, leaving the network's nodes/arcs/packets invisible.)
        renderer = new THREE.WebGPURenderer({ forceWebGL: true, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return;
      }
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.set(0, 0, 8.6);

      const group = new THREE.Group();
      // orient so Japan (~lon 138) faces the camera (+Z), north tilted up
      group.rotation.y = (90 - 138) * D2R;
      group.rotation.x = 18 * D2R;
      scene.add(group);

      const GOLD = new THREE.Color(0xe7c977);
      const GOLD_HOT = new THREE.Color(0xfff0c4);
      const INDIGO = new THREE.Color(0x2b4a86);

      /* ---------- dim globe ---------- */
      const GLOBE = 2200;
      const gp = new Float32Array(GLOBE * 3);
      for (let i = 0; i < GLOBE; i++) {
        const t = i / GLOBE;
        const phi = Math.acos(1 - 2 * t);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        gp[i * 3] = R * Math.sin(phi) * Math.cos(theta);
        gp[i * 3 + 1] = R * Math.sin(phi) * Math.sin(theta);
        gp[i * 3 + 2] = R * Math.cos(phi);
      }
      const globeGeo = new THREE.BufferGeometry();
      globeGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
      const globeMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      globeMat.colorNode = vec4(0.12, 0.21, 0.37, 1.0);
      globeMat.size = 1.4;
      globeMat.sizeAttenuation = true;
      group.add(new THREE.Points(globeGeo, globeMat));

      /* ---------- nodes (born like stars) ---------- */
      const JAPAN = latLon(36, 138);
      const NODE_N = 60;
      const nodes: { pos: THREE.Vector3; birth: number; hub: boolean }[] = [
        { pos: JAPAN.clone(), birth: 0, hub: true },
      ];
      for (let i = 0; i < NODE_N; i++) {
        const lat = Math.asin(Math.random() * 2 - 1) / D2R * 0.85;
        const lon = Math.random() * 360 - 180;
        nodes.push({ pos: latLon(lat, lon), birth: 0.4 + Math.random() * 5.5, hub: false });
      }
      const NN = nodes.length;
      const nodePos = new Float32Array(NN * 3);
      const nodeCol = new Float32Array(NN * 3);
      nodes.forEach((n, i) => nodePos.set([n.pos.x, n.pos.y, n.pos.z], i * 3));
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
      const nodeColAttr = new THREE.BufferAttribute(nodeCol, 3);
      nodeColAttr.setUsage(THREE.DynamicDrawUsage);
      nodeGeo.setAttribute("aColor", nodeColAttr);
      const nodeMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      nodeMat.colorNode = vec4(attribute("aColor"), 1.0);
      nodeMat.size = 7.0;
      nodeMat.sizeAttenuation = true;
      group.add(new THREE.Points(nodeGeo, nodeMat));

      /* ---------- arcs (P2P links) + packets ---------- */
      type Arc = { a: number; b: number; A: THREE.Vector3; C: THREE.Vector3; B: THREE.Vector3; birth: number; off: number };
      const arcs: Arc[] = [];
      const addArc = (a: number, b: number) => {
        const A = nodes[a].pos, B = nodes[b].pos;
        const dist = A.angleTo(B);
        const mid = A.clone().add(B).normalize().multiplyScalar(R * (1.08 + dist * 0.16));
        arcs.push({ a, b, A: A.clone(), C: mid, B: B.clone(), birth: Math.max(nodes[a].birth, nodes[b].birth) + 0.5, off: Math.random() });
      };
      // Japan hub links
      const hubTargets = [...Array(NN - 1).keys()].map((k) => k + 1).sort(() => Math.random() - 0.5).slice(0, 16);
      hubTargets.forEach((t) => addArc(0, t));
      // peer-to-peer: each node to its nearest neighbour
      for (let i = 1; i < NN; i++) {
        let best = -1, bd = Infinity;
        for (let j = 1; j < NN; j++) {
          if (i === j) continue;
          const d = nodes[i].pos.distanceToSquared(nodes[j].pos);
          if (d < bd) { bd = d; best = j; }
        }
        if (best > 0 && Math.random() < 0.7) addArc(i, best);
      }

      const SEG = 22;
      const qbez = (A: THREE.Vector3, C: THREE.Vector3, B: THREE.Vector3, t: number, out: THREE.Vector3) => {
        const u = 1 - t;
        out.set(
          u * u * A.x + 2 * u * t * C.x + t * t * B.x,
          u * u * A.y + 2 * u * t * C.y + t * t * B.y,
          u * u * A.z + 2 * u * t * C.z + t * t * B.z
        );
        return out;
      };
      const arcDots = arcs.length * SEG;
      const arcPos = new Float32Array(arcDots * 3);
      const arcCol = new Float32Array(arcDots * 3);
      const tmp = new THREE.Vector3();
      arcs.forEach((arc, ai) => {
        for (let s = 0; s < SEG; s++) {
          qbez(arc.A, arc.C, arc.B, s / (SEG - 1), tmp);
          const idx = (ai * SEG + s) * 3;
          arcPos[idx] = tmp.x; arcPos[idx + 1] = tmp.y; arcPos[idx + 2] = tmp.z;
        }
      });
      const arcGeo = new THREE.BufferGeometry();
      arcGeo.setAttribute("position", new THREE.BufferAttribute(arcPos, 3));
      const arcColAttr = new THREE.BufferAttribute(arcCol, 3);
      arcColAttr.setUsage(THREE.DynamicDrawUsage);
      arcGeo.setAttribute("aColor", arcColAttr);
      const arcMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      arcMat.colorNode = vec4(attribute("aColor"), 1.0);
      arcMat.size = 1.7;
      arcMat.sizeAttenuation = true;
      group.add(new THREE.Points(arcGeo, arcMat));

      // packets — one per arc, ping-pong (peer-to-peer both ways)
      const pkPos = new Float32Array(arcs.length * 3);
      const pkCol = new Float32Array(arcs.length * 3);
      const pkGeo = new THREE.BufferGeometry();
      const pkPosAttr = new THREE.BufferAttribute(pkPos, 3);
      pkPosAttr.setUsage(THREE.DynamicDrawUsage);
      pkGeo.setAttribute("position", pkPosAttr);
      const pkColAttr = new THREE.BufferAttribute(pkCol, 3);
      pkColAttr.setUsage(THREE.DynamicDrawUsage);
      pkGeo.setAttribute("aColor", pkColAttr);
      const pkMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      pkMat.colorNode = vec4(attribute("aColor"), 1.0);
      pkMat.size = 4.2;
      pkMat.sizeAttenuation = true;
      group.add(new THREE.Points(pkGeo, pkMat));

      await renderer.init();
      if (disposed) return;

      /* ---------- bloom ---------- */
      const post = new THREE.PostProcessing(renderer);
      const scenePass = pass(scene, camera);
      const bloomPass = bloom(scenePass, 0.95, 0.6, 0.18);
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
        const w = mount.clientWidth, h = mount.clientHeight;
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
      const nodeArr = nodeGeo.attributes.aColor.array as Float32Array;
      const arcArr = arcGeo.attributes.aColor.array as Float32Array;
      const pkpArr = pkGeo.attributes.position.array as Float32Array;
      const pkcArr = pkGeo.attributes.aColor.array as Float32Array;
      const pv = new THREE.Vector3();

      const tick = async () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const t = reduce ? 6 : clock.elapsedTime;

        if (!reduce) {
          group.rotation.y = (90 - 138) * D2R + Math.sin(t * 0.06) * 0.25 + pointer.x * 0.35;
          group.rotation.x = 18 * D2R + -pointer.y * 0.2;
        }

        // nodes: birth fade-in + breathing pulse (AI utilisation)
        for (let i = 0; i < NN; i++) {
          const n = nodes[i];
          const age = t - n.birth;
          let b = age <= 0 ? 0 : Math.min(1, age / 0.7);
          const pulse = 0.7 + 0.3 * Math.sin(t * (n.hub ? 1.6 : 1.1) + i * 1.3);
          b *= pulse;
          // twinkle overshoot right after birth
          if (age > 0 && age < 0.5) b *= 1 + (0.5 - age) * 1.6;
          const c = n.hub ? GOLD_HOT : GOLD;
          const k = n.hub ? 2.0 : 1.15;
          nodeArr[i * 3] = c.r * b * k;
          nodeArr[i * 3 + 1] = c.g * b * k;
          nodeArr[i * 3 + 2] = c.b * b * k;
        }
        nodeGeo.attributes.aColor.needsUpdate = true;

        // arcs: fade in after birth, with a travelling brightness crest
        for (let ai = 0; ai < arcs.length; ai++) {
          const arc = arcs[ai];
          const age = t - arc.birth;
          const base = age <= 0 ? 0 : Math.min(0.6, age * 0.6);
          const crest = ((age * 0.32 + arc.off) % 1); // matches packet position
          for (let s = 0; s < SEG; s++) {
            const idx = (ai * SEG + s) * 3;
            const sp = s / (SEG - 1);
            const glow = base * (1 + 1.6 * Math.max(0, 1 - Math.abs(sp - crest) * 9));
            arcArr[idx] = GOLD.r * glow * 0.9 + INDIGO.r * base * 0.35;
            arcArr[idx + 1] = GOLD.g * glow * 0.9 + INDIGO.g * base * 0.35;
            arcArr[idx + 2] = GOLD.b * glow * 0.9 + INDIGO.b * base * 0.35;
          }
        }
        arcGeo.attributes.aColor.needsUpdate = true;

        // packets: ping-pong along each arc
        for (let ai = 0; ai < arcs.length; ai++) {
          const arc = arcs[ai];
          const age = t - arc.birth;
          if (age <= 0) { pkcArr[ai * 3] = pkcArr[ai * 3 + 1] = pkcArr[ai * 3 + 2] = 0; continue; }
          const tri = Math.abs(((age * 0.32 + arc.off) % 1) * 2 - 1); // 0..1..0
          qbez(arc.A, arc.C, arc.B, tri, pv);
          pkpArr[ai * 3] = pv.x; pkpArr[ai * 3 + 1] = pv.y; pkpArr[ai * 3 + 2] = pv.z;
          const fl = 0.8 + 0.2 * Math.sin(t * 9 + ai);
          pkcArr[ai * 3] = GOLD_HOT.r * fl; pkcArr[ai * 3 + 1] = GOLD_HOT.g * fl; pkcArr[ai * 3 + 2] = GOLD_HOT.b * fl;
        }
        pkGeo.attributes.position.needsUpdate = true;
        pkGeo.attributes.aColor.needsUpdate = true;

        camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
        camera.lookAt(0, 0, 0);

        await post.renderAsync();
      };
      tick();

      cleanups.push(() => {
        [globeGeo, globeMat, nodeGeo, nodeMat, arcGeo, arcMat, pkGeo, pkMat].forEach((o) => o.dispose());
      });
    })().catch((err) => {
      console.warn("Hero3D: WebGPU/TSL init failed, showing static background.", err);
      if (renderer?.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
    });

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
