import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero — a global data-linkage network centred on Japan.
 *
 *  - Dim point-cloud globe; Japan is the brightest hub, front and centre.
 *  - Nodes are "born like stars" (staggered twinkling fade-in) worldwide.
 *  - Great-circle arcs link nodes peer-to-peer; light packets travel both ways.
 *  - Nodes breathe/pulse — utilisation incl. AI.
 *
 * Uses only rock-solid, cross-browser primitives: THREE.Sprite (nodes/packets,
 * a soft additive glow texture), THREE.Line (arcs) and THREE.Points (globe).
 * No custom shaders / custom vertex attributes — which failed to render on
 * iOS/WebKit. Animation is plain JS (scale/opacity/position). Opaque canvas.
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    const GOLD = new THREE.Color(0xe7c977);
    const HOT = new THREE.Color(0xfff0c4);

    // soft radial glow sprite texture (canvas)
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d")!;
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(cv);

    const sprite = (color: THREE.Color) => {
      const m = new THREE.SpriteMaterial({
        map: glowTex,
        color: color.clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
      return new THREE.Sprite(m);
    };

    /* ---------- dim globe (points — already reliable) ---------- */
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
    const globeMat = new THREE.PointsMaterial({
      color: 0x2a4575, size: 0.03, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Points(globeGeo, globeMat));

    /* ---------- nodes (sprites) ---------- */
    const JAPAN = latLon(36, 138);
    type Node = { pos: THREE.Vector3; birth: number; hub: boolean; rnd: number; sp: THREE.Sprite; size: number };
    const nodes: Node[] = [];
    const mk = (pos: THREE.Vector3, birth: number, hub: boolean) => {
      const sp = sprite(hub ? HOT : GOLD);
      sp.position.copy(pos);
      sp.scale.setScalar(0.001);
      group.add(sp);
      nodes.push({ pos, birth, hub, rnd: Math.random(), sp, size: hub ? 0.55 : 0.26 });
    };
    mk(JAPAN.clone(), 0, true);
    for (let i = 0; i < 60; i++) {
      const lat = (Math.asin(Math.random() * 2 - 1) / D2R) * 0.85;
      const lon = Math.random() * 360 - 180;
      mk(latLon(lat, lon), 0.4 + Math.random() * 5.5, false);
    }

    /* ---------- arcs (lines) + packets (sprites) ---------- */
    type Arc = { A: THREE.Vector3; C: THREE.Vector3; B: THREE.Vector3; birth: number; off: number; mat: THREE.LineBasicMaterial; pkt: THREE.Sprite };
    const arcs: Arc[] = [];
    const SEG = 26;
    const qbez = (A: THREE.Vector3, C: THREE.Vector3, B: THREE.Vector3, t: number, o: THREE.Vector3) => {
      const u = 1 - t;
      return o.set(
        u * u * A.x + 2 * u * t * C.x + t * t * B.x,
        u * u * A.y + 2 * u * t * C.y + t * t * B.y,
        u * u * A.z + 2 * u * t * C.z + t * t * B.z
      );
    };
    const addArc = (ai: number, bi: number) => {
      const A = nodes[ai].pos, B = nodes[bi].pos;
      const dist = A.angleTo(B);
      const C = A.clone().add(B).normalize().multiplyScalar(R * (1.08 + dist * 0.16));
      const pts: THREE.Vector3[] = [];
      const tmp = new THREE.Vector3();
      for (let s = 0; s < SEG; s++) pts.push(qbez(A, C, B, s / (SEG - 1), tmp).clone());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xc8a24a, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
      group.add(new THREE.Line(geo, mat));
      const pkt = sprite(HOT);
      pkt.scale.setScalar(0.001);
      group.add(pkt);
      arcs.push({ A: A.clone(), C, B: B.clone(), birth: Math.max(nodes[ai].birth, nodes[bi].birth) + 0.5, off: Math.random(), mat, pkt });
    };
    const NN = nodes.length;
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

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const age = t - n.birth;
        let b = age <= 0 ? 0 : Math.min(1, age / 0.7);
        b *= 0.7 + 0.3 * Math.sin(t * (n.hub ? 1.6 : 1.1) + n.rnd * 6.2831);
        if (age > 0 && age < 0.5) b *= 1 + (0.5 - age) * 1.6;
        b = Math.max(0, b);
        n.sp.scale.setScalar(n.size * (0.55 + 0.45 * Math.min(1, b)));
        (n.sp.material as THREE.SpriteMaterial).opacity = Math.min(1, b);
      }

      for (let i = 0; i < arcs.length; i++) {
        const a = arcs[i];
        const age = t - a.birth;
        a.mat.opacity = age <= 0 ? 0 : Math.min(0.5, age * 0.5);
        if (age <= 0) { (a.pkt.material as THREE.SpriteMaterial).opacity = 0; continue; }
        const tri = Math.abs(((age * 0.32 + a.off) % 1) * 2 - 1);
        qbez(a.A, a.C, a.B, tri, pv);
        a.pkt.position.copy(pv);
        a.pkt.scale.setScalar(0.16);
        (a.pkt.material as THREE.SpriteMaterial).opacity = 0.9;
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
      glowTex.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Sprite || o instanceof THREE.Line) {
          (o as any).geometry?.dispose?.();
          ((o as any).material as THREE.Material)?.dispose?.();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" aria-hidden="true" />;
}
