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
 * ALL animation is GPU-driven from a single `uTime` uniform — there are no
 * per-frame CPU buffer updates. This keeps every geometry static (like the
 * globe), which renders reliably on every browser incl. iPad/Safari, where
 * per-frame attribute re-uploads proved unreliable. Opaque canvas + additive
 * "glow" points (core + halo), no post-processing.
 */
export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
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
    renderer.setClearColor(0x0d1729, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.6);

    const group = new THREE.Group();
    group.rotation.y = (90 - 138) * D2R;
    group.rotation.x = 18 * D2R;
    scene.add(group);

    const GOLD = new THREE.Vector3(0.905, 0.788, 0.467);
    const HOT = new THREE.Vector3(1.0, 0.94, 0.77);
    const IND = new THREE.Vector3(0.169, 0.29, 0.525);

    const uTime = { value: 0 };
    const uPR = { value: PR };
    const allMats: THREE.ShaderMaterial[] = [];

    // shared round-soft additive fragment
    const FRAG = /* glsl */ `
      precision highp float;
      uniform float uMul;
      varying vec3 vColor;
      void main(){
        if (dot(vColor, vColor) < 0.0002) discard;
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = pow(smoothstep(0.5, 0.0, d), 1.4);
        gl_FragColor = vec4(vColor * uMul, a);
      }
    `;
    const baseMat = (vertex: string, size: number, mul: number, extra: Record<string, { value: any }> = {}) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime, uPR, uSize: { value: size }, uMul: { value: mul }, ...extra },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: vertex,
        fragmentShader: FRAG,
      });
      allMats.push(m);
      return m;
    };

    /* ---------- dim globe (static) ---------- */
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
    const globeVert = /* glsl */ `
      uniform float uSize, uPR;
      varying vec3 vColor;
      void main(){
        vColor = vec3(0.13, 0.22, 0.42);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPR * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const globe = new THREE.Points(globeGeo, baseMat(globeVert, 2.0, 1.0));
    group.add(globe);

    /* ---------- nodes (GPU-animated) ---------- */
    const JAPAN = latLon(36, 138);
    const NODE_N = 60;
    const nodes: { pos: THREE.Vector3; birth: number; hub: number }[] = [{ pos: JAPAN.clone(), birth: 0, hub: 1 }];
    for (let i = 0; i < NODE_N; i++) {
      const lat = (Math.asin(Math.random() * 2 - 1) / D2R) * 0.85;
      const lon = Math.random() * 360 - 180;
      nodes.push({ pos: latLon(lat, lon), birth: 0.4 + Math.random() * 5.5, hub: 0 });
    }
    const NN = nodes.length;
    const nPos = new Float32Array(NN * 3);
    const nBirth = new Float32Array(NN);
    const nHub = new Float32Array(NN);
    const nRnd = new Float32Array(NN);
    nodes.forEach((n, i) => {
      nPos.set([n.pos.x, n.pos.y, n.pos.z], i * 3);
      nBirth[i] = n.birth; nHub[i] = n.hub; nRnd[i] = Math.random();
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nPos, 3));
    nodeGeo.setAttribute("aBirth", new THREE.BufferAttribute(nBirth, 1));
    nodeGeo.setAttribute("aHub", new THREE.BufferAttribute(nHub, 1));
    nodeGeo.setAttribute("aRnd", new THREE.BufferAttribute(nRnd, 1));
    const nodeVert = /* glsl */ `
      uniform float uTime, uSize, uPR;
      uniform vec3 uGold, uHot;
      attribute float aBirth, aHub, aRnd;
      varying vec3 vColor;
      void main(){
        float age = uTime - aBirth;
        float b = age <= 0.0 ? 0.0 : clamp(age / 0.7, 0.0, 1.0);
        float freq = mix(1.1, 1.6, aHub);
        b *= 0.7 + 0.3 * sin(uTime * freq + aRnd * 6.2831);
        b *= (age > 0.0 && age < 0.5) ? (1.0 + (0.5 - age) * 1.6) : 1.0;
        vec3 c = mix(uGold, uHot, aHub);
        float k = mix(1.1, 1.8, aHub);
        vColor = c * max(b, 0.0) * k;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPR * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const nodeUniforms = { uGold: { value: GOLD }, uHot: { value: HOT } };
    group.add(new THREE.Points(nodeGeo, baseMat(nodeVert, 26, 0.22, { ...nodeUniforms }))); // halo
    group.add(new THREE.Points(nodeGeo, baseMat(nodeVert, 7, 1.0, { ...nodeUniforms })));    // core

    /* ---------- arcs ---------- */
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
    const qbez = (A: THREE.Vector3, C: THREE.Vector3, B: THREE.Vector3, t: number, o: THREE.Vector3) => {
      const u = 1 - t;
      return o.set(
        u * u * A.x + 2 * u * t * C.x + t * t * B.x,
        u * u * A.y + 2 * u * t * C.y + t * t * B.y,
        u * u * A.z + 2 * u * t * C.z + t * t * B.z
      );
    };
    const AD = arcs.length * SEG;
    const aPos = new Float32Array(AD * 3);
    const aBirth = new Float32Array(AD);
    const aSp = new Float32Array(AD);
    const aOff = new Float32Array(AD);
    const tmp = new THREE.Vector3();
    arcs.forEach((arc, ai) => {
      for (let s = 0; s < SEG; s++) {
        qbez(arc.A, arc.C, arc.B, s / (SEG - 1), tmp);
        const idx = ai * SEG + s;
        aPos[idx * 3] = tmp.x; aPos[idx * 3 + 1] = tmp.y; aPos[idx * 3 + 2] = tmp.z;
        aBirth[idx] = arc.birth; aSp[idx] = s / (SEG - 1); aOff[idx] = arc.off;
      }
    });
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute("position", new THREE.BufferAttribute(aPos, 3));
    arcGeo.setAttribute("aBirth", new THREE.BufferAttribute(aBirth, 1));
    arcGeo.setAttribute("aSp", new THREE.BufferAttribute(aSp, 1));
    arcGeo.setAttribute("aOff", new THREE.BufferAttribute(aOff, 1));
    const arcVert = /* glsl */ `
      uniform float uTime, uSize, uPR;
      uniform vec3 uGold, uInd;
      attribute float aBirth, aSp, aOff;
      varying vec3 vColor;
      void main(){
        float age = uTime - aBirth;
        float base = age <= 0.0 ? 0.0 : min(0.55, age * 0.6);
        float crest = fract(uTime * 0.32 + aOff);
        float glow = base * (1.0 + 1.7 * max(0.0, 1.0 - abs(aSp - crest) * 9.0));
        vColor = uGold * glow * 0.9 + uInd * base * 0.35;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPR * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `;
    group.add(new THREE.Points(arcGeo, baseMat(arcVert, 2.2, 1.0, { uGold: { value: GOLD }, uInd: { value: IND } })));

    /* ---------- packets (position computed in shader) ---------- */
    const PN = arcs.length;
    const pPos = new Float32Array(PN * 3);
    const pA = new Float32Array(PN * 3);
    const pMid = new Float32Array(PN * 3);
    const pB = new Float32Array(PN * 3);
    const pBirth = new Float32Array(PN);
    const pOff = new Float32Array(PN);
    arcs.forEach((arc, i) => {
      pPos.set([arc.A.x, arc.A.y, arc.A.z], i * 3);
      pA.set([arc.A.x, arc.A.y, arc.A.z], i * 3);
      pMid.set([arc.C.x, arc.C.y, arc.C.z], i * 3);
      pB.set([arc.B.x, arc.B.y, arc.B.z], i * 3);
      pBirth[i] = arc.birth; pOff[i] = arc.off;
    });
    const pkGeo = new THREE.BufferGeometry();
    pkGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pkGeo.setAttribute("aA", new THREE.BufferAttribute(pA, 3));
    pkGeo.setAttribute("aMid", new THREE.BufferAttribute(pMid, 3));
    pkGeo.setAttribute("aB", new THREE.BufferAttribute(pB, 3));
    pkGeo.setAttribute("aBirth", new THREE.BufferAttribute(pBirth, 1));
    pkGeo.setAttribute("aOff", new THREE.BufferAttribute(pOff, 1));
    const pkVert = /* glsl */ `
      uniform float uTime, uSize, uPR;
      uniform vec3 uHot;
      attribute vec3 aA, aMid, aB;
      attribute float aBirth, aOff;
      varying vec3 vColor;
      void main(){
        float age = uTime - aBirth;
        float tri = abs(fract(uTime * 0.32 + aOff) * 2.0 - 1.0);
        float u = 1.0 - tri;
        vec3 p = u*u*aA + 2.0*u*tri*aMid + tri*tri*aB;
        float fl = 0.85 + 0.15 * sin(uTime * 9.0 + aOff * 30.0);
        vColor = uHot * fl * (age <= 0.0 ? 0.0 : 1.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * uPR * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const pkHalo = new THREE.Points(pkGeo, baseMat(pkVert, 18, 0.3, { uHot: { value: HOT } }));
    const pkCore = new THREE.Points(pkGeo, baseMat(pkVert, 5, 1.0, { uHot: { value: HOT } }));
    pkHalo.frustumCulled = false; pkCore.frustumCulled = false;
    group.add(pkHalo); group.add(pkCore);

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

    /* ---------- loop (only uniforms + transform change) ---------- */
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = reduce ? 6 : clock.elapsedTime;
      uTime.value = t;
      if (!reduce) {
        group.rotation.y = (90 - 138) * D2R + Math.sin(t * 0.06) * 0.25 + pointer.x * 0.35;
        group.rotation.x = 18 * D2R + -pointer.y * 0.2;
      }
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
      [globeGeo, nodeGeo, arcGeo, pkGeo].forEach((g) => g.dispose());
      allMats.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" aria-hidden="true" />;
}
