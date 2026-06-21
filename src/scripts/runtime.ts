import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { EN } from "../i18n";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   Smooth scroll (Lenis) + GSAP ScrollTrigger
   ============================================================ */
gsap.registerPlugin(ScrollTrigger, SplitText);

if (!reduce) {
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // anchor links route through Lenis for buttery jumps
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target as HTMLElement, { offset: -10, duration: 1.1 });
      }
    });
  });
}

/* ============================================================
   Reveal on scroll
   ============================================================ */
const reveals = gsap.utils.toArray<HTMLElement>(".reveal");
if (reduce) {
  reveals.forEach((el) => el.classList.add("is-in"));
} else {
  reveals.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: "top 86%",
      once: true,
      onEnter: () => el.classList.add("is-in"),
    });
  });

  /* parallax layers: [data-parallax="0.2"] (fraction of travel) */
  gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
    const speed = parseFloat(el.dataset.parallax || "0.2");
    gsap.to(el, {
      yPercent: -speed * 100,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
    });
  });
}

/* ============================================================
   Language toggle (JP <-> EN)
   ============================================================ */
const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"));
const JA: Record<string, string> = {};
nodes.forEach((el) => (JA[el.getAttribute("data-i18n")!] = el.innerHTML));

function setLang(lang: "ja" | "en") {
  nodes.forEach((el) => {
    const key = el.getAttribute("data-i18n")!;
    const val = lang === "en" ? EN[key] : JA[key];
    if (val !== undefined) el.innerHTML = val;
  });
  document.documentElement.lang = lang;
  document.body.dataset.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-lang-opt]").forEach((o) => {
    o.classList.toggle("is-active", o.dataset.langOpt === lang);
  });
  try {
    localStorage.setItem("takaki-lang", lang);
  } catch {}
  ScrollTrigger.refresh();
}

document.getElementById("langToggle")?.addEventListener("click", () => {
  setLang(document.body.dataset.lang === "en" ? "ja" : "en");
});

let saved: string | null = "ja";
try {
  saved = localStorage.getItem("takaki-lang") || "ja";
} catch {}
if (saved === "en") setLang("en");

/* ============================================================
   Hero entrance — kinetic typography (SplitText)
   ============================================================ */
if (!reduce) {
  const title = document.querySelector<HTMLElement>(".hero__title");
  if (title) {
    const l1 = title.querySelector<HTMLElement>(".hero__line:not(.hero__line--accent)");
    const l2 = title.querySelector<HTMLElement>(".hero__line--accent");
    const tl = gsap.timeline({ delay: 0.2 });
    if (l1) {
      // split only the plain line into characters (keeps the gradient
      // accent line intact, which background-clip:text would break per char)
      const split = new SplitText(l1, { type: "chars" });
      tl.from(split.chars, { yPercent: 120, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.04 }, 0);
    }
    if (l2) {
      tl.from(l2, { yPercent: 38, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.26);
    }
  }
  gsap.from([".hero__lead", ".hero__cta"], {
    y: 24,
    opacity: 0,
    duration: 0.9,
    ease: "power3.out",
    stagger: 0.12,
    delay: 0.75,
  });
}

/* ============================================================
   Nav: scrolled state + mobile menu + year
   ============================================================ */
const nav = document.getElementById("nav");
const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const burger = document.getElementById("burger");
const links = document.getElementById("navLinks");
burger?.addEventListener("click", () => {
  const open = links?.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", open ? "true" : "false");
});
links?.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
  })
);

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
