import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero — a global data-linkage network centred on Japan.
 *
 *  - Dim point-cloud globe; Japan is the brightest hub, front and centre.
 *  - Nodes are "born like stars" (staggered twinkling fade-in) worldwide.
 *  - Great-circle arcs link nodes peer-to-peer; light packets travel both ways
 *    (trusted, sovereign exchange). Nodes breathe/pulse — utilisation incl. AI.
 *
 * Built on the classic THREE.WebGLRenderer with additive soft "glow" points
 * (core + halo layers) instead of post-processing — rock-solid on every
 * browser incl. iPad/Safari. Transparent canvas over the CSS gradient.
 */
export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      // Opaque canvas: paints its own dark background so additive points only
      // ever brighten it. (A transparent canvas + additive blending composites
      // as dark "blobs" on iOS/Safari.)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      return;
    }

    const R = 3.0;
    const D2R = Math.PI / 180;
    const latLon = (lat: number, lon: number, r = R) => {
      const phi = (90 - lat) * D2R, theta = lon * D2R;
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    let width = mount.clientWidth;
    let height = mount.clientHeight;
    const PR = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(PR);
    renderer.setSize(width, height);
    renderer.setClearColor(0x0d1729, 1); // matches the hero CSS backdrop
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.6);

    const group = new THREE.Group();
    group.rotation.y = (90 - 138) * D2R;
    group.rotation.x = 18 * D2R;
    scene.add(group);

    // round, soft, additive glowing point material (per-vertex colour + size)
    const makeMat = (size: number, mul = 1.0, soft = 0.5) =>
      new THREE.ShaderMaterial({
        uniforms: { uSize: { value: size }, uPR: { value: PR }, uMul: { value: mul }, uSoft: { value: soft } },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uSize; uniform float uPR;
          varying vec3 vColor;
          void main(){
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * uPR * (8.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uMul; uniform float uSoft;
          varying vec3 vColor;
          void main(){
            if (dot(vColor, vColor) < 0.0002) discard; // skip un-born / dark points
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float a = pow(smoothstep(0.5, uSoft * 0.5, d), 1.4);
            gl_FragColor = vec4(vColor * uMul, a);
          }
        `,
      });

    const GOLD = new THREE.Color(0xe7c977);
    const GOLD_HOT = new THREE.Color(0xfff0c4);
    const INDIGO = new THREE.Color(0x2b4a86);

    /* ---------- dim globe ---------- */
    const GLOBE = 2200;
    const gp = new Float32Array(GLOBE * 3);
    const gc = new Float32Array(GLOBE * 3);
    for (let i = 0; i < GLOBE; i++) {
      const t = i / GLOBE;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      gp[i * 3] = R * Math.sin(phi) * Math.cos(theta);
      gp[i * 3 + 1] = R * Math.sin(phi) * Math.sin(theta);
      gp[i * 3 + 2] = R * Math.cos(phi);
      gc[i * 3] = 0.13; gc[i * 3 + 1] = 0.22; gc[i * 3 + 2] = 0.42;
    }
    const globeGeo = new THREE.BufferGeometry();
    globeGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
    globeGeo.setAttribute("color", new THREE.BufferAttribute(gc, 3));
    group.add(new THREE.Points(globeGeo, makeMat(2.0)));

    /* ---------- nodes ---------- */
    const JAPAN = latLon(36, 138);
    const NODE_N = 60;
    const nodes: { pos: THREE.Vector3; birth: number; hub: boolean }[] = [{ pos: JAPAN.clone(), birth: 0, hub: true }];
    for (let i = 0; i < NODE_N; i++) {
      const lat = (Math.asin(Math.random() * 2 - 1) / D2R) * 0.85;
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
    nodeGeo.setAttribute("color", nodeColAttr);
    group.add(new THREE.Points(nodeGeo, makeMat(26, 0.22, 0.0))); // halo glow
    group.add(new THREE.Points(nodeGeo, makeMat(7, 1.0)));         // bright core

    /* ---------- arcs + packets ---------- */
    type Arc = { A: THREE.Vector3; C: THREE.Vector3; B: THREE.Vector3; birth: number; off: number };
    const arcs: Arc[] = [];
    const addArc = (a: number, b: number) => {
      const A = nodes[a].pos, B = nodes[b].pos;
      const dist = A.angleTo(B);
      const C = A.clone().add(B).normalize().multiplyScalar(R * (1.08 + dist * 0.16));
      arcs.push({ A: A.clone(), C, B: B.clone(), birth: Math.max(nodes[a].birth, nodes[b].birth) + 0.5, off: Math.random() });
    };
    [...Array(NN - 1).keys()].map((k) => k + 1).sort(() => Math.random() - 0.5).slice(0, 16).forEach((t) => addArc(0, t));
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
    arcGeo.setAttribute("color", arcColAttr);
    group.add(new THREE.Points(arcGeo, makeMat(2.2)));

    const pkPos = new Float32Array(arcs.length * 3);
    const pkCol = new Float32Array(arcs.length * 3);
    const pkGeo = new THREE.BufferGeometry();
    const pkPosAttr = new THREE.BufferAttribute(pkPos, 3); pkPosAttr.setUsage(THREE.DynamicDrawUsage);
    const pkColAttr = new THREE.BufferAttribute(pkCol, 3); pkColAttr.setUsage(THREE.DynamicDrawUsage);
    pkGeo.setAttribute("position", pkPosAttr);
    pkGeo.setAttribute("color", pkColAttr);
    group.add(new THREE.Points(pkGeo, makeMat(18, 0.3, 0.0))); // halo
    group.add(new THREE.Points(pkGeo, makeMat(5, 1.0)));        // core

    /* ---------- interaction ---------- */
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const onResize = () => {
      width = mount.clientWidth; height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let visible = true;
    const onVis = () => (visible = document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);

    /* ---------- loop ---------- */
    const clock = new THREE.Clock();
    let raf = 0;
    const pv = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = reduce ? 6 : clock.elapsedTime;

      if (!reduce) {
        group.rotation.y = (90 - 138) * D2R + Math.sin(t * 0.06) * 0.25 + pointer.x * 0.35;
        group.rotation.x = 18 * D2R + -pointer.y * 0.2;
      }

      for (let i = 0; i < NN; i++) {
        const n = nodes[i];
        const age = t - n.birth;
        let b = age <= 0 ? 0 : Math.min(1, age / 0.7);
        b *= 0.7 + 0.3 * Math.sin(t * (n.hub ? 1.6 : 1.1) + i * 1.3);
        if (age > 0 && age < 0.5) b *= 1 + (0.5 - age) * 1.6;
        const c = n.hub ? GOLD_HOT : GOLD;
        const k = n.hub ? 1.8 : 1.1;
        nodeCol[i * 3] = c.r * b * k; nodeCol[i * 3 + 1] = c.g * b * k; nodeCol[i * 3 + 2] = c.b * b * k;
      }
      nodeColAttr.needsUpdate = true;

      for (let ai = 0; ai < arcs.length; ai++) {
        const arc = arcs[ai];
        const age = t - arc.birth;
        const base = age <= 0 ? 0 : Math.min(0.55, age * 0.6);
        const crest = (age * 0.32 + arc.off) % 1;
        for (let s = 0; s < SEG; s++) {
          const idx = (ai * SEG + s) * 3;
          const sp = s / (SEG - 1);
          const glow = base * (1 + 1.7 * Math.max(0, 1 - Math.abs(sp - crest) * 9));
          arcCol[idx] = GOLD.r * glow * 0.9 + INDIGO.r * base * 0.35;
          arcCol[idx + 1] = GOLD.g * glow * 0.9 + INDIGO.g * base * 0.35;
          arcCol[idx + 2] = GOLD.b * glow * 0.9 + INDIGO.b * base * 0.35;
        }
      }
      arcColAttr.needsUpdate = true;

      for (let ai = 0; ai < arcs.length; ai++) {
        const arc = arcs[ai];
        const age = t - arc.birth;
        if (age <= 0) { pkCol[ai * 3] = pkCol[ai * 3 + 1] = pkCol[ai * 3 + 2] = 0; continue; }
        const tri = Math.abs(((age * 0.32 + arc.off) % 1) * 2 - 1);
        qbez(arc.A, arc.C, arc.B, tri, pv);
        pkPos[ai * 3] = pv.x; pkPos[ai * 3 + 1] = pv.y; pkPos[ai * 3 + 2] = pv.z;
        const fl = 0.85 + 0.15 * Math.sin(t * 9 + ai);
        pkCol[ai * 3] = GOLD_HOT.r * fl; pkCol[ai * 3 + 1] = GOLD_HOT.g * fl; pkCol[ai * 3 + 2] = GOLD_HOT.b * fl;
      }
      pkPosAttr.needsUpdate = true;
      pkColAttr.needsUpdate = true;

      camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    tick();

    /* ---------- cleanup ---------- */
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        if (o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" aria-hidden="true" />;
}
