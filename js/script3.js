/* =============================================================================
 * portfolio.js — Tanmoy Biswas
 * -----------------------------------------------------------------------------
 * Zero-dependency interaction layer. Replaces jQuery 3.6, Typed.js 2.0,
 * Waypoints 4.0 and Owl Carousel 2.3 (~118 KB of vendor code) with ~34 KB of
 * purpose-built ES2022.
 *
 * Architecture
 *   Kernel      one requestAnimationFrame loop drives every animation on the
 *               page; modules subscribe instead of opening their own loops.
 *   Module      lifecycle base class (mount / destroy) with automatic listener
 *               teardown. Registry mounts by selector and isolates failures so
 *               a single broken module can never blank the page.
 *   Reads/writes are batched: layout is measured on resize into a cached
 *               Viewport, and per-frame work only ever writes to transforms
 *               and opacity to stay off the layout/paint path.
 *
 * Everything degrades: no JS renders full static content, no IntersectionObserver
 * reveals everything immediately, and prefers-reduced-motion disables motion
 * rather than merely shortening it.
 * ========================================================================== */

"use strict";

const Portfolio = (() => {
  /* ===========================================================================
   * 1 — Environment
   * ======================================================================== */

  /** @type {{io:boolean, ro:boolean, waapi:boolean, finePointer:boolean, canvas:boolean}} */
  const SUPPORTS = {
    io: "IntersectionObserver" in window,
    ro: "ResizeObserver" in window,
    waapi: typeof Element !== "undefined" && "animate" in Element.prototype,
    finePointer: matchMedia("(hover: hover) and (pointer: fine)").matches,
    canvas: (() => {
      try {
        return !!document.createElement("canvas").getContext("2d");
      } catch {
        return false;
      }
    })(),
  };

  /* --- tiny DOM + math helpers ------------------------------------------- */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  /** Always-positive modulo — the backbone of the carousel's wrap-around. */
  const mod = (n, m) => ((n % m) + m) % m;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);

  /** Namespaced localStorage that no-ops in private mode instead of throwing. */
  const Store = {
    key: (k) => `tb.portfolio.${k}`,
    get(k, fallback = null) {
      try {
        const raw = localStorage.getItem(Store.key(k));
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(k, value) {
      try {
        localStorage.setItem(Store.key(k), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };

  /* ===========================================================================
   * 2 — Motion preference
   * A single source of truth. Reacts live to OS changes and to the in-page
   * override exposed through the command palette.
   * ======================================================================== */

  const Motion = {
    _query: matchMedia("(prefers-reduced-motion: reduce)"),
    _override: Store.get("reduce-motion", null), // true | false | null (= follow OS)
    _subs: new Set(),

    get reduced() {
      return this._override === null ? this._query.matches : this._override;
    },
    get enabled() {
      return !this.reduced;
    },

    /** @param {boolean|null} value true, false, or null to follow the OS */
    setOverride(value) {
      this._override = value;
      Store.set("reduce-motion", value);
      this._emit();
    },
    toggle() {
      this.setOverride(!this.reduced);
      return this.reduced;
    },
    subscribe(fn) {
      this._subs.add(fn);
      return () => this._subs.delete(fn);
    },
    _emit() {
      const root = document.documentElement;
      root.classList.toggle("reduce-motion", this.reduced);
      // Lets CSS honour the OS media query when JS has no explicit opinion,
      // while an explicit "motion on" override still wins.
      root.classList.toggle("motion-on", this._override === false);
      this._subs.forEach((fn) => fn(this.reduced));
    },
    init() {
      this._query.addEventListener("change", () => this._emit());
      this._emit();
    },
  };

  /* ===========================================================================
   * 3 — Kernel: one rAF loop for the whole page
   * Frames stop entirely when nothing is subscribed or the tab is hidden, so an
   * idle background tab costs zero CPU. Delta time is normalised to 60fps units
   * and clamped, so a stalled tab can never fling springs into orbit.
   * ======================================================================== */

  class Kernel {
    constructor() {
      /** @type {Set<(dt:number, now:number)=>void>} */
      this.tasks = new Set();
      this.running = false;
      this.last = 0;
      this.frameMs = 16.67; // smoothed frame cost, drives adaptive quality
      this._tick = this._tick.bind(this);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) this.start();
      });
    }

    /** @returns {()=>void} unsubscribe */
    add(task) {
      this.tasks.add(task);
      this.start();
      return () => this.tasks.delete(task);
    }

    start() {
      if (this.running || !this.tasks.size || document.hidden) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._tick);
    }

    _tick(now) {
      const raw = now - this.last;
      this.last = now;
      // Clamp to 4 frames: prevents huge integration steps after a stall.
      const dt = clamp(raw, 0, 64) / 16.67;
      this.frameMs += (raw - this.frameMs) * 0.05;

      for (const task of this.tasks) {
        try {
          task(dt, now);
        } catch (err) {
          this.tasks.delete(task);
          console.error("[kernel] task removed", err);
        }
      }

      if (this.tasks.size && !document.hidden)
        requestAnimationFrame(this._tick);
      else this.running = false;
    }
  }

  const kernel = new Kernel();

  /* ===========================================================================
   * 4 — Viewport: layout read once per resize, never inside a frame
   * ======================================================================== */

  const Viewport = {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    scrollY: window.scrollY,
    maxScroll: 1,
    _subs: new Set(),

    subscribe(fn) {
      this._subs.add(fn);
      return () => this._subs.delete(fn);
    },

    measure() {
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - this.h,
      );
      this._subs.forEach((fn) => fn(this));
    },

    init() {
      let resizeRaf = 0;
      const onResize = () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => this.measure());
      };
      addEventListener("resize", onResize, { passive: true });
      addEventListener("orientationchange", onResize, { passive: true });
      if (document.fonts?.ready)
        document.fonts.ready.then(() => this.measure());
      addEventListener(
        "scroll",
        () => {
          this.scrollY = window.scrollY;
        },
        { passive: true },
      );
      this.measure();
    },
  };

  /* ===========================================================================
   * 5 — Spring: critically-damped integrator used by the cursor, hero tilt and
   * carousel. Cheaper than a full RK4 solver and stable at any frame rate.
   * ======================================================================== */

  class Spring {
    constructor(
      value = 0,
      { stiffness = 0.14, damping = 0.72, epsilon = 0.0015 } = {},
    ) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.stiffness = stiffness;
      this.damping = damping;
      this.epsilon = epsilon;
    }
    set(value) {
      this.value = this.target = value;
      this.velocity = 0;
    }
    /** @returns {boolean} true while still moving — lets callers skip DOM writes */
    step(dt = 1) {
      const delta = this.target - this.value;
      if (
        Math.abs(delta) < this.epsilon &&
        Math.abs(this.velocity) < this.epsilon
      ) {
        this.value = this.target;
        this.velocity = 0;
        return false;
      }
      this.velocity += delta * this.stiffness * dt;
      this.velocity *= Math.pow(this.damping, dt);
      this.value += this.velocity * dt;
      return true;
    }
  }

  /* ===========================================================================
   * 6 — Module base + registry
   * ======================================================================== */

  class Module {
    /** @type {string|null} CSS selector each instance is mounted against */
    static selector = null;

    constructor(el) {
      this.el = el;
      /** @type {Array<()=>void>} */
      this._teardown = [];
    }

    /** addEventListener that unbinds itself on destroy(). */
    on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this._teardown.push(() =>
        target.removeEventListener(type, handler, options),
      );
      return handler;
    }

    /** Subscribe to the shared rAF loop; auto-unsubscribed on destroy(). */
    frame(task) {
      this._teardown.push(kernel.add(task));
    }

    /** Register any other cleanup (observers, timers). */
    cleanup(fn) {
      this._teardown.push(fn);
    }

    mount() {}

    destroy() {
      this._teardown.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      this._teardown.length = 0;
    }
  }

  const Registry = {
    /** @type {Array<typeof Module>} */
    definitions: [],
    /** @type {Module[]} */
    instances: [],

    define(...modules) {
      this.definitions.push(...modules);
      return this;
    },

    mountAll() {
      for (const Def of this.definitions) {
        const targets = Def.selector
          ? qsa(Def.selector)
          : [document.documentElement];
        for (const el of targets) {
          // Failure isolation: one broken module must not take the page down.
          try {
            const instance = new Def(el);
            instance.mount();
            this.instances.push(instance);
          } catch (err) {
            console.error(`[${Def.name}] failed to mount`, err);
          }
        }
      }
      return this;
    },

    destroyAll() {
      this.instances.forEach((i) => i.destroy());
      this.instances.length = 0;
    },
  };

  /* ===========================================================================
   * 7 — Announcer: one polite live region shared by every module
   * ======================================================================== */

  const Announcer = {
    el: null,
    init() {
      this.el = qs("[data-announcer]");
    },
    say(message) {
      if (!this.el) return;
      this.el.textContent = "";
      // Re-setting on the next frame guarantees screen readers see a change.
      requestAnimationFrame(() => {
        this.el.textContent = message;
      });
    },
  };

  /* ===========================================================================
   * 8 — Fuzzy matcher (fzf-style subsequence scoring)
   * Returns null when the query is not a subsequence of the text; otherwise a
   * score plus the matched indices so the palette can highlight them.
   * ======================================================================== */

  const BONUS = { start: 12, wordStart: 8, consecutive: 6, camel: 5 };

  /**
   * @param {string} query
   * @param {string} text
   * @returns {{score:number, indices:number[]}|null}
   */
  function fuzzyMatch(query, text) {
    const q = query.trim().toLowerCase();
    if (!q) return { score: 0, indices: [] };

    const lower = text.toLowerCase();
    const indices = [];
    let score = 0;
    let cursor = 0;
    let prevMatched = -2;

    for (const ch of q) {
      if (ch === " ") continue;
      const found = lower.indexOf(ch, cursor);
      if (found === -1) return null;

      const before = text[found - 1];
      if (found === 0) score += BONUS.start;
      else if (before && /[\s\-_/·.]/.test(before)) score += BONUS.wordStart;
      else if (
        before &&
        before === before.toLowerCase() &&
        text[found] === text[found].toUpperCase()
      )
        score += BONUS.camel;

      if (found === prevMatched + 1) score += BONUS.consecutive;
      score -= Math.min(found - cursor, 6) * 0.4; // gap penalty, bounded

      indices.push(found);
      prevMatched = found;
      cursor = found + 1;
    }

    // Prefer tighter, shorter matches.
    score -= text.length * 0.03;
    return { score, indices };
  }

  /** Escape then wrap matched characters in <mark> for safe innerHTML use. */
  function highlight(text, indices) {
    const set = new Set(indices);
    let out = "";
    let open = false;
    for (let i = 0; i < text.length; i++) {
      const hit = set.has(i);
      if (hit && !open) {
        out += "<mark>";
        open = true;
      }
      if (!hit && open) {
        out += "</mark>";
        open = false;
      }
      out += text[i]
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    return open ? out + "</mark>" : out;
  }

  /* ===========================================================================
   * 9 — Focus trap, shared by the mobile menu and the command palette
   * ======================================================================== */

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocus(container) {
    const previous = document.activeElement;
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      const nodes = qsa(FOCUSABLE, container).filter(
        (n) => n.offsetParent !== null,
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeydown, true);
    return () => {
      document.removeEventListener("keydown", onKeydown, true);
      if (previous instanceof HTMLElement && document.contains(previous))
        previous.focus();
    };
  }

  /* ===========================================================================
   * 10 — SmoothScroll
   * A hand-rolled eased scroll instead of `scroll-behavior: smooth`, because we
   * need three things CSS cannot give: an offset for the sticky navbar, a
   * duration that scales with distance, and cancellation the moment the user
   * touches the wheel. Falls back to an instant jump under reduced motion.
   * ======================================================================== */

  const SmoothScroll = {
    _raf: 0,
    _cancel: null,

    /** Cubic ease-in-out — symmetric, no overshoot at either end. */
    ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },

    offset() {
      const nav = qs(".navbar");
      return nav ? nav.offsetHeight * 0.75 : 0;
    },

    /** @param {HTMLElement|number} target element or absolute Y */
    to(target) {
      const destY =
        typeof target === "number"
          ? target
          : window.scrollY + target.getBoundingClientRect().top - this.offset();
      const to = clamp(destY, 0, Viewport.maxScroll);
      const from = window.scrollY;
      const distance = to - from;

      this.stop();
      if (Motion.reduced || Math.abs(distance) < 4) {
        window.scrollTo(0, to);
        return Promise.resolve();
      }

      // 480ms floor, +0.35ms per pixel, 1200ms ceiling.
      const duration = clamp(480 + Math.abs(distance) * 0.35, 480, 1200);
      const start = performance.now();

      return new Promise((resolve) => {
        const abort = () => {
          this.stop();
          resolve();
        };
        const opts = { passive: true, once: true };
        ["wheel", "touchstart", "pointerdown"].forEach((t) =>
          addEventListener(t, abort, opts),
        );
        this._cancel = () =>
          ["wheel", "touchstart", "pointerdown"].forEach((t) =>
            removeEventListener(t, abort, opts),
          );

        const step = (now) => {
          const t = clamp((now - start) / duration, 0, 1);
          window.scrollTo(0, from + distance * this.ease(t));
          if (t < 1) this._raf = requestAnimationFrame(step);
          else {
            this.stop();
            resolve();
          }
        };
        this._raf = requestAnimationFrame(step);
      });
    },

    stop() {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._cancel?.();
      this._cancel = null;
    },
  };

  /* ===========================================================================
   * 11 — Navigation: sticky state, scrollspy, focus-trapped mobile drawer
   * ======================================================================== */

  class Navigation extends Module {
    static selector = ".navbar";

    mount() {
      this.links = qsa('.menu a[href^="#"]', this.el);
      this.menu = qs(".menu", this.el);
      this.toggleBtn = qs(".menu-btn", this.el);
      this.scrollTopBtn = qs(".scroll-up-btn");
      this.drawerOpen = false;
      this._releaseTrap = null;

      // Section targets, measured on resize rather than on every scroll frame.
      this.sections = this.links
        .map((a) => ({
          link: a,
          el: qs(a.getAttribute("href")),
          top: 0,
          bottom: 0,
        }))
        .filter((s) => s.el);

      this.cleanup(Viewport.subscribe(() => this.measure()));
      this.measure();

      this.on(window, "scroll", () => this.onScroll(), { passive: true });
      this.onScroll();

      this.links.forEach((link) =>
        this.on(link, "click", (e) => {
          const target = qs(link.getAttribute("href"));
          if (!target) return;
          e.preventDefault();
          this.closeDrawer();
          SmoothScroll.to(target).then(() => {
            history.replaceState(null, "", link.getAttribute("href"));
            // Move focus into the section so keyboard users land where they aimed.
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
          });
        }),
      );

      if (this.toggleBtn) {
        this.toggleBtn.setAttribute("aria-expanded", "false");
        this.toggleBtn.setAttribute("aria-controls", "primary-menu");
        this.on(this.toggleBtn, "click", () => this.toggleDrawer());
      }

      this.on(document, "keydown", (e) => {
        if (e.key === "Escape" && this.drawerOpen) this.closeDrawer();
      });

      if (this.scrollTopBtn) {
        this.on(this.scrollTopBtn, "click", () => SmoothScroll.to(0));
      }

      // Deep link support: honour #hash on load once layout has settled.
      if (location.hash) {
        const target = qs(location.hash);
        if (target) requestAnimationFrame(() => SmoothScroll.to(target));
      }
    }

    measure() {
      this.sections.forEach((s) => {
        const rect = s.el.getBoundingClientRect();
        s.top = rect.top + window.scrollY;
        s.bottom = s.top + rect.height;
      });
    }

    onScroll() {
      const y = window.scrollY;
      this.el.classList.toggle("sticky", y > 20);
      this.scrollTopBtn?.classList.toggle("show", y > 500);

      // Scrollspy: the section owning the viewport's upper third wins.
      const probe = y + Viewport.h * 0.32;
      let active = null;
      for (const s of this.sections)
        if (probe >= s.top && probe < s.bottom) active = s;
      if (active === this._active) return;
      this._active = active;
      this.sections.forEach((s) => {
        const on = s === active;
        s.link.classList.toggle("active", on);
        if (on) s.link.setAttribute("aria-current", "true");
        else s.link.removeAttribute("aria-current");
      });
    }

    toggleDrawer() {
      this.drawerOpen ? this.closeDrawer() : this.openDrawer();
    }

    openDrawer() {
      this.drawerOpen = true;
      this.menu.classList.add("active");
      this.toggleBtn?.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-open");
      this._releaseTrap = trapFocus(this.menu);
      qs(FOCUSABLE, this.menu)?.focus();
    }

    closeDrawer() {
      if (!this.drawerOpen) return;
      this.drawerOpen = false;
      this.menu.classList.remove("active");
      this.toggleBtn?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
      this._releaseTrap?.();
      this._releaseTrap = null;
    }
  }

  /* ===========================================================================
   * 12 — ScrollProgress: reading indicator driven by transform only
   * ======================================================================== */

  class ScrollProgress extends Module {
    static selector = "[data-scroll-progress]";

    mount() {
      this.bar = qs(".progress-bar-fill", this.el) || this.el;
      let last = -1;
      this.on(
        window,
        "scroll",
        () => {
          const p = clamp(window.scrollY / Viewport.maxScroll, 0, 1);
          // Skip the write unless it changes a visible pixel.
          if (Math.abs(p - last) < 0.002) return;
          last = p;
          this.bar.style.transform = `scaleX(${p})`;
          this.el.setAttribute("aria-valuenow", String(Math.round(p * 100)));
        },
        { passive: true },
      );
    }
  }

  /* ===========================================================================
   * 13 — Reveal: IntersectionObserver with index-based stagger
   * ======================================================================== */

  class Reveal extends Module {
    static selector = null; // page-level singleton

    mount() {
      const items = qsa(".reveal");
      if (!items.length) return;

      if (!SUPPORTS.io || Motion.reduced) {
        items.forEach((el) => el.classList.add("in-view"));
        return;
      }

      // Group siblings so a row of cards cascades instead of popping together.
      const groupIndex = new Map();
      items.forEach((el) => {
        const parent = el.parentElement;
        const n = groupIndex.get(parent) ?? 0;
        groupIndex.set(parent, n + 1);
        el.style.setProperty("--reveal-delay", `${Math.min(n, 5) * 90}ms`);
      });

      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("in-view");
            io.unobserve(entry.target); // one-shot: no work after reveal
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
      );

      items.forEach((el) => io.observe(el));
      this.cleanup(() => io.disconnect());
    }
  }

  /* ===========================================================================
   * 14 — Counters: eased count-up that respects decimal precision
   * ======================================================================== */

  class Counters extends Module {
    static selector = null;

    mount() {
      const nodes = qsa("[data-count]");
      if (!nodes.length) return;

      const run = (el) => {
        const target = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        if (Number.isNaN(target)) return;

        if (Motion.reduced) {
          el.textContent = target.toFixed(decimals);
          return;
        }

        const duration = 1400;
        let elapsed = 0;
        const stop = kernel.add((dt) => {
          elapsed += dt * 16.67;
          const t = clamp(elapsed / duration, 0, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = (target * eased).toFixed(decimals);
          if (t >= 1) {
            el.textContent = target.toFixed(decimals);
            stop();
          }
        });
        this.cleanup(stop);
      };

      if (!SUPPORTS.io) {
        nodes.forEach(run);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            run(entry.target);
            io.unobserve(entry.target);
          }
        },
        { threshold: 0.5 },
      );
      nodes.forEach((el) => io.observe(el));
      this.cleanup(() => io.disconnect());
    }
  }

  /* ===========================================================================
   * 15 — Typewriter (replaces Typed.js)
   * An async/await state machine rather than a chain of timeouts: the whole
   * type → hold → delete cycle reads top to bottom, and a single generation
   * counter cancels an in-flight cycle on destroy. Adds per-keystroke jitter so
   * the rhythm reads human, skips the shared word prefix when rotating between
   * phrases, and parks itself while the tab is hidden or the element is
   * offscreen so it never burns frames nobody is watching.
   * ======================================================================== */

  class Typewriter extends Module {
    static selector = "[data-typewriter]";

    mount() {
      /** @type {string[]} */
      this.words = JSON.parse(this.el.dataset.typewriter || "[]");
      if (!this.words.length) return;

      this.speed = parseInt(this.el.dataset.speed || "58", 10);
      this.backSpeed = parseInt(this.el.dataset.backSpeed || "26", 10);
      this.hold = parseInt(this.el.dataset.hold || "1600", 10);
      this.generation = 0;
      this.visible = true;

      // Screen readers get the full list as static text; the animation is decor.
      this.el.innerHTML = "";
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = this.words.join(", ");
      const out = document.createElement("span");
      out.className = "tw-out";
      out.setAttribute("aria-hidden", "true");
      const caret = document.createElement("span");
      caret.className = "tw-caret";
      caret.setAttribute("aria-hidden", "true");
      this.el.append(sr, out, caret);
      this.out = out;

      if (Motion.reduced) {
        out.textContent = this.words[0];
        caret.remove();
        return;
      }

      if (SUPPORTS.io) {
        const io = new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
        });
        io.observe(this.el);
        this.cleanup(() => io.disconnect());
      }

      this.cleanup(() => {
        this.generation++;
      }); // cancels the running cycle
      this.run();
    }

    /** Resolves only when the tab is visible and the element is on screen. */
    async gate() {
      while (document.hidden || !this.visible) {
        await sleep(220);
        if (this.dead) return;
      }
    }

    /** @param {number} gen generation snapshot; a mismatch aborts the cycle */
    async run() {
      const gen = ++this.generation;
      this.dead = false;
      let index = 0;

      while (gen === this.generation) {
        const word = this.words[index % this.words.length];
        const next = this.words[(index + 1) % this.words.length];

        await this.type(word, gen);
        if (gen !== this.generation) return;

        await sleep(this.hold);
        if (gen !== this.generation) return;

        // Only delete back to the shared prefix — feels intentional, not lazy.
        let shared = 0;
        while (
          shared < word.length &&
          shared < next.length &&
          word[shared] === next[shared]
        )
          shared++;
        await this.erase(Math.max(shared, 0), gen);
        index++;
      }
    }

    async type(word, gen) {
      const current = this.out.textContent;
      for (let i = current.length; i <= word.length; i++) {
        if (gen !== this.generation) return;
        await this.gate();
        this.out.textContent = word.slice(0, i);
        // Longer beat after punctuation and spaces mimics real typing.
        const ch = word[i - 1] || "";
        const jitter = rand(0.65, 1.5) * (/[\s,.&]/.test(ch) ? 2.1 : 1);
        await sleep(this.speed * jitter);
      }
    }

    async erase(toLength, gen) {
      for (let i = this.out.textContent.length; i > toLength; i--) {
        if (gen !== this.generation) return;
        await this.gate();
        this.out.textContent = this.out.textContent.slice(0, i - 1);
        await sleep(this.backSpeed * rand(0.7, 1.3));
      }
    }

    destroy() {
      this.dead = true;
      super.destroy();
    }
  }

  /* ===========================================================================
   * 16 — Pointer: one shared pointer position for cursor, tilt and particles
   * ======================================================================== */

  const Pointer = {
    x: -9999,
    y: -9999,
    nx: 0,
    ny: 0,
    active: false,
    down: false,
    init() {
      addEventListener(
        "pointermove",
        (e) => {
          this.x = e.clientX;
          this.y = e.clientY;
          this.nx = (e.clientX / Viewport.w) * 2 - 1; // -1 .. 1
          this.ny = (e.clientY / Viewport.h) * 2 - 1;
          this.active = true;
        },
        { passive: true },
      );
      addEventListener(
        "pointerdown",
        () => {
          this.down = true;
        },
        { passive: true },
      );
      addEventListener(
        "pointerup",
        () => {
          this.down = false;
        },
        { passive: true },
      );
      addEventListener(
        "pointerleave",
        () => {
          this.active = false;
        },
        { passive: true },
      );
    },
  };

  /* ===========================================================================
   * 17 — CustomCursor: spring-driven ring + magnetic elements
   * The dot tracks raw pointer position for precision; the ring trails it on a
   * spring so it feels weighted. Both write only transforms, and the loop
   * unsubscribes itself once the ring settles.
   * ======================================================================== */

  class CustomCursor extends Module {
    static selector = null;

    mount() {
      this.dot = qs(".cursor-dot");
      this.ring = qs(".cursor-ring");
      if (!this.dot || !this.ring || !SUPPORTS.finePointer) return;
      // Hidden by CSS rather than removed, so the palette can toggle it back on.
      document.documentElement.classList.toggle(
        "has-custom-cursor",
        !Motion.reduced,
      );
      this.cleanup(() =>
        document.documentElement.classList.remove("has-custom-cursor"),
      );
      if (Motion.reduced) return;
      this.rx = new Spring(Pointer.x, { stiffness: 0.2, damping: 0.62 });
      this.ry = new Spring(Pointer.y, { stiffness: 0.2, damping: 0.62 });
      this.scale = new Spring(1, { stiffness: 0.22, damping: 0.6 });

      this.frame((dt) => {
        this.rx.target = Pointer.x;
        this.ry.target = Pointer.y;
        const moving =
          this.rx.step(dt) || this.ry.step(dt) || this.scale.step(dt);
        this.dot.style.transform = `translate3d(${Pointer.x}px, ${Pointer.y}px, 0) translate(-50%, -50%)`;
        if (!moving) return;
        this.ring.style.transform = `translate3d(${this.rx.value}px, ${this.ry.value}px, 0) translate(-50%, -50%) scale(${this.scale.value})`;
      });

      // Delegation, so cards and links added later still get the effect.
      const HOVER =
        "a, button, .btn, .btn-block, .spec-card, .skill-chip, .pf-nav, .menu-btn, .scroll-up-btn, input, [data-magnetic]";
      this.on(document, "pointerover", (e) => {
        if (e.target.closest?.(HOVER)) {
          this.ring.classList.add("hover");
          this.scale.target = 1.45;
        }
      });
      this.on(document, "pointerout", (e) => {
        if (e.target.closest?.(HOVER)) {
          this.ring.classList.remove("hover");
          this.scale.target = 1;
        }
      });
      this.on(document, "pointerdown", () => {
        this.scale.target *= 0.8;
      });
      this.on(document, "pointerup", () => {
        this.scale.target = this.ring.classList.contains("hover") ? 1.45 : 1;
      });
    }
  }

  /* ===========================================================================
   * 18 — Magnetic: buttons that lean toward the cursor inside a radius
   * ======================================================================== */

  class Magnetic extends Module {
    static selector = "[data-magnetic]";

    mount() {
      if (!SUPPORTS.finePointer || Motion.reduced) return;
      this.strength = parseFloat(this.el.dataset.magnetic || "0.28");
      this.x = new Spring(0, { stiffness: 0.16, damping: 0.7 });
      this.y = new Spring(0, { stiffness: 0.16, damping: 0.7 });
      this.rect = null;
      this.inRange = false;

      const remeasure = () => {
        this.rect = this.el.getBoundingClientRect();
      };
      this.cleanup(Viewport.subscribe(remeasure));
      this.on(window, "scroll", remeasure, { passive: true });
      remeasure();

      this.frame((dt) => {
        if (this.rect && Pointer.active) {
          const cx = this.rect.left + this.rect.width / 2;
          const cy = this.rect.top + this.rect.height / 2;
          const dx = Pointer.x - cx;
          const dy = Pointer.y - cy;
          const radius = Math.max(this.rect.width, this.rect.height) * 1.15;
          const dist = Math.hypot(dx, dy);
          this.inRange = dist < radius;
          const falloff = this.inRange ? 1 - dist / radius : 0;
          this.x.target = dx * this.strength * falloff;
          this.y.target = dy * this.strength * falloff;
        } else {
          this.x.target = 0;
          this.y.target = 0;
        }
        const moving = this.x.step(dt) || this.y.step(dt);
        if (moving)
          this.el.style.setProperty(
            "--mag",
            `translate3d(${this.x.value}px, ${this.y.value}px, 0)`,
          );
      });
    }
  }

  /* ===========================================================================
   * 19 — Spotlight: pointer-tracked glare on glass cards
   * One delegated listener for every card on the page, coalesced into a single
   * frame write. Only the hovered card's custom properties are touched.
   * ======================================================================== */

  class Spotlight extends Module {
    static selector = null;

    mount() {
      if (!SUPPORTS.finePointer || Motion.reduced) return;
      let pending = null;
      let scheduled = false;

      this.on(
        document,
        "pointermove",
        (e) => {
          const card = e.target.closest?.(".spec-card, .panel");
          if (!card) return;
          pending = { card, x: e.clientX, y: e.clientY };
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            if (!pending) return;
            const { card: c, x, y } = pending;
            const r = c.getBoundingClientRect();
            c.style.setProperty(
              "--spot-x",
              `${((x - r.left) / r.width) * 100}%`,
            );
            c.style.setProperty(
              "--spot-y",
              `${((y - r.top) / r.height) * 100}%`,
            );
            c.classList.add("lit");
          });
        },
        { passive: true },
      );

      this.on(document, "pointerout", (e) => {
        const card = e.target.closest?.(".spec-card, .panel");
        if (card && !card.contains(e.relatedTarget))
          card.classList.remove("lit");
      });
    }
  }

  /* ===========================================================================
   * 20 — HeroParallax: spring-smoothed 3D tilt + scroll-linked depth
   * ======================================================================== */

  class HeroParallax extends Module {
    static selector = ".home";

    mount() {
      this.tilt = qs(".parallax-tilt", this.el);
      this.items = qsa(".parallax-item", this.el);
      this.ghost = qs(".hero-ghost", this.el);
      if (Motion.reduced || !SUPPORTS.finePointer) return;

      this.rx = new Spring(0, { stiffness: 0.09, damping: 0.75 });
      this.ry = new Spring(0, { stiffness: 0.09, damping: 0.75 });
      this.hovering = false;

      this.on(this.el, "pointerenter", () => {
        this.hovering = true;
      });
      this.on(this.el, "pointerleave", () => {
        this.hovering = false;
      });

      this.frame((dt) => {
        // Rest at zero when the pointer is elsewhere, rather than freezing.
        this.rx.target = this.hovering ? -Pointer.ny * 9 : 0;
        this.ry.target = this.hovering ? Pointer.nx * 9 : 0;
        const moving = this.rx.step(dt) || this.ry.step(dt);
        if (!moving) return;

        if (this.tilt) {
          this.tilt.style.transform = `perspective(1000px) rotateX(${this.rx.value}deg) rotateY(${this.ry.value}deg)`;
        }
        for (const item of this.items) {
          const speed = parseFloat(item.dataset.speed || "0.04") * 26;
          item.style.transform = `translate3d(${this.ry.value * speed}px, ${-this.rx.value * speed}px, 0)`;
        }
        if (this.ghost) {
          this.ghost.style.transform = `translate(-50%, -50%) translate3d(${this.ry.value * -2.2}px, ${this.rx.value * 2.2}px, 0)`;
        }
      });
    }
  }

  /* ===========================================================================
   * 21 — ParticleField: canvas constellation behind the hero
   *
   * The interesting part is neighbour lookup. Linking every pair is O(n²) —
   * 130 particles means 8,385 distance checks per frame. Instead particles are
   * bucketed into a spatial hash whose cell size equals the link distance, so
   * each particle only tests its own cell and four neighbours, and the pass
   * becomes O(n). The grid is rebuilt each frame; for this population that is
   * far cheaper than the comparisons it removes.
   *
   * Quality is adaptive: the field samples the kernel's smoothed frame cost and
   * sheds particles on slow hardware rather than dropping frames. It also stops
   * completely when scrolled out of view or the tab is hidden.
   * ======================================================================== */

  const LINK_DIST = 132;
  const POINTER_RADIUS = 190;

  class ParticleField extends Module {
    static selector = "[data-particles]";

    mount() {
      if (!SUPPORTS.canvas || Motion.reduced) return; // CSS hides the canvas

      this.ctx = this.el.getContext("2d", { alpha: true });
      /** @type {{x:number,y:number,vx:number,vy:number,r:number}[]} */
      this.particles = [];
      this.grid = new Map();
      this.onScreen = true;
      this.quality = 1;
      this.sampleFrames = 0;
      this.palette = this.readPalette();

      this.resize();
      this.cleanup(Viewport.subscribe(() => this.resize()));

      if (SUPPORTS.io) {
        const io = new IntersectionObserver(([entry]) => {
          this.onScreen = entry.isIntersecting;
        });
        io.observe(this.el);
        this.cleanup(() => io.disconnect());
      }

      this.frame((dt) => this.render(dt));
    }

    /** Pull accent colours out of the stylesheet so JS never hardcodes theme. */
    readPalette() {
      const css = getComputedStyle(document.documentElement);
      const pick = (name, fallback) =>
        css.getPropertyValue(name).trim() || fallback;
      return {
        dot: pick("--blue-light", "#7FB4FF"),
        link: pick("--blue", "#4C8DFF"),
        hot: pick("--cyan", "#7FE3FF"),
      };
    }

    targetCount() {
      const area = this.w * this.h;
      const base = SUPPORTS.finePointer ? 15500 : 26000; // sparser on phones
      return Math.round(clamp((area / base) * this.quality, 18, 130));
    }

    resize() {
      const rect = this.el.getBoundingClientRect();
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      // Back the canvas at device resolution, draw in CSS pixels.
      this.el.width = Math.round(this.w * Viewport.dpr);
      this.el.height = Math.round(this.h * Viewport.dpr);
      this.ctx.setTransform(Viewport.dpr, 0, 0, Viewport.dpr, 0, 0);
      this.cols = Math.max(1, Math.ceil(this.w / LINK_DIST));
      this.sync();
    }

    /** Grow or shrink the population toward the target without a full rebuild. */
    sync() {
      const target = this.targetCount();
      while (this.particles.length > target) this.particles.pop();
      while (this.particles.length < target) {
        this.particles.push({
          x: rand(0, this.w),
          y: rand(0, this.h),
          vx: rand(-0.22, 0.22),
          vy: rand(-0.22, 0.22),
          r: rand(0.9, 2.2),
        });
      }
    }

    /** Frame-cost sampling: shed or restore detail every ~90 frames. */
    adapt() {
      if (++this.sampleFrames < 90) return;
      this.sampleFrames = 0;
      const cost = kernel.frameMs;
      if (cost > 21 && this.quality > 0.4) {
        this.quality -= 0.15;
        this.sync();
      } else if (cost < 13.5 && this.quality < 1) {
        this.quality = Math.min(1, this.quality + 0.1);
        this.sync();
      }
    }

    key(x, y) {
      return ((y / LINK_DIST) | 0) * this.cols + ((x / LINK_DIST) | 0);
    }

    render(dt) {
      if (!this.onScreen) return;
      this.adapt();

      const { ctx, particles, w, h } = this;
      ctx.clearRect(0, 0, w, h);

      // Pointer position relative to the canvas, valid only while over it.
      const rect = this.el.getBoundingClientRect();
      const px = Pointer.x - rect.left;
      const py = Pointer.y - rect.top;
      const pointerInside =
        Pointer.active && px > -80 && px < w + 80 && py > -80 && py < h + 80;

      this.grid.clear();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Integrate, with a soft push away from the cursor.
        if (pointerInside) {
          const dx = p.x - px;
          const dy = p.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 1) {
            const d = Math.sqrt(d2);
            const force = (1 - d / POINTER_RADIUS) * 0.55;
            p.vx += (dx / d) * force * dt;
            p.vy += (dy / d) * force * dt;
          }
        }

        p.vx = clamp(p.vx * 0.985, -1.6, 1.6);
        p.vy = clamp(p.vy * 0.985, -1.6, 1.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Wrap, so the field never thins out at the edges.
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        else if (p.y > h + 10) p.y = -10;

        const k = this.key(p.x, p.y);
        const bucket = this.grid.get(k);
        if (bucket) bucket.push(i);
        else this.grid.set(k, [i]);
      }

      // --- links: own cell + 4 forward neighbours (no pair counted twice) ---
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.palette.link;
      const cols = this.cols;
      for (const [key, bucket] of this.grid) {
        const neighbours = [
          key,
          key + 1,
          key + cols - 1,
          key + cols,
          key + cols + 1,
        ];
        for (let a = 0; a < bucket.length; a++) {
          const p = particles[bucket[a]];
          for (let n = 0; n < neighbours.length; n++) {
            const other = n === 0 ? bucket : this.grid.get(neighbours[n]);
            if (!other) continue;
            const from = n === 0 ? a + 1 : 0;
            for (let b = from; b < other.length; b++) {
              const q = particles[other[b]];
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > LINK_DIST * LINK_DIST) continue;
              ctx.globalAlpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.22;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }
      }

      // --- nodes, brighter near the cursor ---
      for (const p of particles) {
        let heat = 0;
        if (pointerInside) {
          heat = clamp(
            1 - Math.hypot(p.x - px, p.y - py) / POINTER_RADIUS,
            0,
            1,
          );
        }
        ctx.globalAlpha = 0.35 + heat * 0.5;
        ctx.fillStyle = heat > 0.55 ? this.palette.hot : this.palette.dot;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + heat * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ===========================================================================
   * 22 — Timeline: spine fill + node activation
   * Node offsets are cached on resize; the scroll frame does pure arithmetic.
   * ======================================================================== */

  class Timeline extends Module {
    static selector = ".timeline";

    mount() {
      this.fill = qs(".timeline-spine-fill", this.el);
      this.nodes = qsa(".timeline-node", this.el);
      if (!this.fill) return;

      this.offsets = [];
      const measure = () => {
        const rect = this.el.getBoundingClientRect();
        this.top = rect.top + window.scrollY;
        this.height = rect.height || 1;
        this.offsets = this.nodes.map(
          (n) => n.getBoundingClientRect().top + window.scrollY - this.top,
        );
      };
      this.cleanup(Viewport.subscribe(measure));
      measure();

      let lastProgress = -1;
      const update = () => {
        const progress = clamp(
          (window.scrollY + Viewport.h * 0.5 - this.top) / this.height,
          0,
          1,
        );
        if (Math.abs(progress - lastProgress) < 0.0015) return;
        lastProgress = progress;
        this.fill.style.transform = `scaleY(${progress})`;
        const filled = progress * this.height;
        this.nodes.forEach((node, i) =>
          node.classList.toggle("active", filled >= this.offsets[i]),
        );
      };
      this.on(window, "scroll", update, { passive: true });
      this.cleanup(Viewport.subscribe(update));
      update();
    }
  }

  /* ===========================================================================
   * 23 — Carousel (replaces Owl Carousel)
   *
   * Infinite looping without cloned slides. Every slide owns a *virtual*
   * position derived from a single floating-point offset:
   *
   *     offset  = mod(index - pos + LEAD, N) - LEAD
   *     x       = offset * (slideWidth + gap)
   *
   * Because the modulo wraps, a slide that leaves the right edge reappears on
   * the left automatically — no DOM cloning, no index bookkeeping, no seam to
   * hide, and `pos` may drift arbitrarily far without ever needing a reset.
   * LEAD keeps one and a half slides staged off the left edge so dragging
   * backwards never reveals a gap.
   *
   * `pos` is a spring, so programmatic navigation, drag release and momentum
   * all resolve through the same integrator instead of competing animations.
   * The whole thing costs one transform write per visible slide per frame, and
   * stops writing entirely once the spring settles.
   * ======================================================================== */

  const LEAD = 1.5;

  class Carousel extends Module {
    static selector = "[data-carousel]";

    mount() {
      this.viewport = qs(".pf-viewport", this.el);
      this.track = qs(".pf-track", this.el);
      this.allSlides = qsa(".pf-slide", this.track);
      if (!this.viewport || !this.track || !this.allSlides.length) return;

      this.slides = this.allSlides.slice();
      this.pos = new Spring(0, {
        stiffness: 0.12,
        damping: 0.68,
        epsilon: 0.0004,
      });
      this.looping = true;
      this.dragging = false;
      this.paused = false;
      this.onScreen = true;
      this.autoplayMs = parseInt(this.el.dataset.autoplay || "2800", 10);
      this._autoplayAcc = 0;
      this._written = new WeakMap();

      this.el.setAttribute("role", "group");
      this.el.setAttribute("aria-roledescription", "carousel");
      this.track.setAttribute("aria-live", "off");

      this.buildDots();
      this.bindNav();
      this.bindDrag();
      this.bindKeyboard();

      this.cleanup(Viewport.subscribe(() => this.measure()));
      // Card heights change with wrapped text, so watch the viewport box too —
      // but only react to *width* changes, since this module writes the height.
      if (SUPPORTS.ro) {
        const ro = new ResizeObserver(() => {
          const w = this.viewport.clientWidth;
          if (w === this._lastWidth) return;
          this.measure();
        });
        ro.observe(this.viewport);
        this.cleanup(() => ro.disconnect());
      }
      if (SUPPORTS.io) {
        const io = new IntersectionObserver(([e]) => {
          this.onScreen = e.isIntersecting;
        });
        io.observe(this.el);
        this.cleanup(() => io.disconnect());
      }

      ["pointerenter", "focusin"].forEach((t) =>
        this.on(this.el, t, () => {
          this.paused = true;
        }),
      );
      ["pointerleave", "focusout"].forEach((t) =>
        this.on(this.el, t, () => {
          this.paused = false;
        }),
      );

      // A link receiving focus inside an offscreen slide pulls it into view.
      this.on(this.track, "focusin", (e) => {
        const slide = e.target.closest(".pf-slide");
        const i = this.slides.indexOf(slide);
        if (i >= 0) this.goTo(i);
      });

      this.measure();
      this.frame((dt) => this.tick(dt));
    }

    /* --- geometry ------------------------------------------------------- */

    measure() {
      const styles = getComputedStyle(this.viewport);
      // CSS owns the breakpoints; JS just reads the result.
      this.perView = Math.max(
        1,
        parseInt(styles.getPropertyValue("--per-view") || "3", 10),
      );
      this.gap = parseFloat(styles.getPropertyValue("--pf-gap") || "20");
      this.width = this._lastWidth = this.viewport.clientWidth;
      this.slideWidth =
        (this.width - this.gap * (this.perView - 1)) / this.perView;
      this.step = this.slideWidth + this.gap;
      this.looping = this.slides.length > this.perView;

      // Measure natural heights first, then equalise. Reading before writing
      // keeps this to a single layout pass, and it only runs on resize.
      this.track.style.height = "auto";
      let tallest = 0;
      for (const slide of this.slides) {
        slide.style.width = `${this.slideWidth}px`;
        slide.style.height = "auto";
      }
      for (const slide of this.slides)
        tallest = Math.max(tallest, slide.offsetHeight);
      this.track.style.height = `${tallest}px`;
      for (const slide of this.slides) slide.style.height = `${tallest}px`;

      this.el.classList.toggle("is-static", !this.looping);
      if (!this.looping) this.pos.set(0);
      this._written = new WeakMap(); // force a full rewrite at new geometry
      this.layout();
      this.syncDots();
    }

    /** Write transforms for the current `pos`. Skips unchanged slides. */
    layout() {
      const p = this.pos.value;
      const n = this.slides.length;
      for (let i = 0; i < n; i++) {
        const slide = this.slides[i];
        const offset = this.looping ? mod(i - p + LEAD, n) - LEAD : i - p;
        const x = offset * this.step;
        if (this._written.get(slide) !== x) {
          this._written.set(slide, x);
          slide.style.transform = `translate3d(${x}px, 0, 0)`;
        }
        // Anything fully outside the viewport is hidden from AT and tab order.
        const visible = offset > -0.9 && offset < this.perView - 0.1;
        if (slide.dataset.visible !== String(visible)) {
          slide.dataset.visible = String(visible);
          slide.setAttribute("aria-hidden", visible ? "false" : "true");
          qsa("a, button", slide).forEach((node) => {
            if (visible) node.removeAttribute("tabindex");
            else node.setAttribute("tabindex", "-1");
          });
        }
      }
    }

    tick(dt) {
      if (!this.dragging) {
        const moving = this.pos.step(dt);
        if (moving) {
          this.layout();
          this.syncDots();
        }
      }

      if (
        !this.looping ||
        this.paused ||
        this.dragging ||
        document.hidden ||
        !this.onScreen ||
        Motion.reduced ||
        !this.autoplayMs
      )
        return;

      this._autoplayAcc += dt * 16.67;
      if (this._autoplayAcc >= this.autoplayMs) {
        this._autoplayAcc = 0;
        this.next();
      }
    }

    /* --- navigation ----------------------------------------------------- */

    get index() {
      return mod(Math.round(this.pos.target), this.slides.length);
    }

    next() {
      this.pos.target += 1;
      this._autoplayAcc = 0;
    }
    prev() {
      this.pos.target -= 1;
      this._autoplayAcc = 0;
    }

    /** Travel the shortest way round the loop to `i`. */
    goTo(i, announce = false) {
      const n = this.slides.length;
      if (!n) return;
      if (!this.looping) {
        this.pos.target = clamp(i, 0, Math.max(0, n - this.perView));
        return;
      }
      const delta = mod(i - mod(this.pos.target, n) + n / 2, n) - n / 2;
      this.pos.target += delta;
      this._autoplayAcc = 0;
      if (announce) Announcer.say(`Project ${i + 1} of ${n}`);
    }

    bindNav() {
      const prev = qs("[data-carousel-prev]") || qs(".pf-nav.prev");
      const next = qs("[data-carousel-next]") || qs(".pf-nav.next");
      if (prev)
        this.on(prev, "click", () => {
          this.prev();
          Announcer.say(`Project ${this.index + 1} of ${this.slides.length}`);
        });
      if (next)
        this.on(next, "click", () => {
          this.next();
          Announcer.say(`Project ${this.index + 1} of ${this.slides.length}`);
        });
    }

    bindKeyboard() {
      this.on(this.el, "keydown", (e) => {
        if (e.target.matches("input, textarea")) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          this.next();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.prev();
        } else if (e.key === "Home") {
          e.preventDefault();
          this.goTo(0, true);
        } else if (e.key === "End") {
          e.preventDefault();
          this.goTo(this.slides.length - 1, true);
        }
      });
    }

    /* --- pointer drag with inertia -------------------------------------- */

    bindDrag() {
      let startX = 0,
        startPos = 0,
        lastX = 0,
        velocity = 0,
        moved = 0,
        pointerId = null;

      this.on(this.viewport, "pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        pointerId = e.pointerId;
        this.dragging = true;
        this.viewport.setPointerCapture(pointerId);
        startX = lastX = e.clientX;
        startPos = this.pos.value;
        velocity = 0;
        moved = 0;
        this.el.classList.add("is-dragging");
      });

      this.on(
        this.viewport,
        "pointermove",
        (e) => {
          if (!this.dragging || e.pointerId !== pointerId) return;
          const dx = e.clientX - startX;
          moved = Math.abs(dx);
          // Exponential moving average keeps the release velocity stable.
          velocity = lerp(velocity, (e.clientX - lastX) / this.step, 0.35);
          lastX = e.clientX;
          this.pos.value = this.pos.target = startPos - dx / this.step;
          if (!this.looping) {
            this.pos.value = this.pos.target = clamp(
              this.pos.value,
              -0.35,
              Math.max(0, this.slides.length - this.perView) + 0.35,
            );
          }
          this.layout();
          this.syncDots();
        },
        { passive: true },
      );

      const release = (e) => {
        if (!this.dragging || (e && e.pointerId !== pointerId)) return;
        this.dragging = false;
        this.el.classList.remove("is-dragging");
        // Flick momentum, capped so a hard swipe stays readable.
        const projected = this.pos.value - clamp(velocity * 4.5, -2, 2);
        this.pos.target = Math.round(projected);
        if (!this.looping) {
          this.pos.target = clamp(
            this.pos.target,
            0,
            Math.max(0, this.slides.length - this.perView),
          );
        }
        this.pos.velocity = 0;
        kernel.start();
        if (moved > 8) {
          // Swallow the click that ends a drag so it never opens a project.
          const swallow = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          this.viewport.addEventListener("click", swallow, {
            capture: true,
            once: true,
          });
          setTimeout(
            () =>
              this.viewport.removeEventListener("click", swallow, {
                capture: true,
              }),
            60,
          );
        }
        Announcer.say(`Project ${this.index + 1} of ${this.slides.length}`);
      };

      this.on(this.viewport, "pointerup", release);
      this.on(this.viewport, "pointercancel", release);
      this.on(this.viewport, "dragstart", (e) => e.preventDefault());
    }

    /* --- dots ----------------------------------------------------------- */

    buildDots() {
      this.dotsWrap =
        qs("[data-carousel-dots]", this.el) || qs("[data-carousel-dots]");
      if (!this.dotsWrap) return;
      this.dotsWrap.innerHTML = "";
      this.dots = this.slides.map((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "pf-dot";
        dot.setAttribute("aria-label", `Go to project ${i + 1}`);
        dot.addEventListener("click", () => this.goTo(i, true));
        this.dotsWrap.appendChild(dot);
        return dot;
      });
    }

    syncDots() {
      if (!this.dots?.length) return;
      const active = mod(Math.round(this.pos.value), this.slides.length);
      if (active === this._activeDot) return;
      this._activeDot = active;
      this.dots.forEach((dot, i) => {
        const on = i === active;
        dot.classList.toggle("active", on);
        dot.setAttribute("aria-current", on ? "true" : "false");
      });
    }

    /* --- filtering ------------------------------------------------------ */

    /** @param {HTMLElement[]} slides subset of the original slides, in order */
    setVisible(slides) {
      this.slides = slides;
      for (const slide of this.allSlides) {
        const shown = slides.includes(slide);
        slide.hidden = !shown;
        if (!shown) slide.style.transform = "";
      }
      this.pos.set(0);
      this.buildDots();
      this.measure();
      this.slides.forEach((slide, i) => {
        slide.setAttribute("role", "group");
        slide.setAttribute("aria-roledescription", "slide");
        slide.setAttribute("aria-label", `${i + 1} of ${slides.length}`);
      });
    }
  }

  /* ===========================================================================
   * 24 — ProjectFilter: fuzzy search + tag chips over the carousel
   * Content stays in the HTML (crawlable, works with JS off) and is *hydrated*
   * into an index on mount, rather than rendered from a JS array.
   * State round-trips through the query string so a filtered view is shareable.
   * ======================================================================== */

  class ProjectFilter extends Module {
    static selector = "[data-filter-root]";

    mount() {
      this.carousel = Registry.instances.find((m) => m instanceof Carousel);
      if (!this.carousel?.allSlides) return;

      this.chips = qsa("[data-tag]", this.el);
      this.input = qs("[data-filter-search]", this.el);
      this.countEl = qs("[data-filter-count]", this.el);
      this.emptyEl = qs("[data-filter-empty]");
      this.tag = "all";
      this.query = "";

      // Hydrate a search index from the markup that is already on the page.
      this.index = this.carousel.allSlides.map((slide) => ({
        slide,
        tags: (slide.dataset.tags || "").split(/[,\s]+/).filter(Boolean),
        haystack: [
          qs(".text", slide)?.textContent ?? "",
          slide.dataset.tags?.replace(/,/g, " ") ?? "",
          qs("p", slide)?.textContent ?? "",
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      }));

      this.chips.forEach((chip) =>
        this.on(chip, "click", () => {
          this.tag = chip.dataset.tag;
          this.apply();
        }),
      );

      if (this.input) {
        let debounce = 0;
        this.on(this.input, "input", () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => {
            this.query = this.input.value;
            this.apply();
          }, 120);
        });
        this.on(this.input, "keydown", (e) => {
          if (e.key !== "Escape" || !this.input.value) return;
          this.input.value = "";
          this.query = "";
          this.apply();
        });
      }

      // Restore ?tag= / ?q= from the URL.
      const params = new URLSearchParams(location.search);
      const tag = params.get("tag");
      const q = params.get("q");
      if (tag && this.chips.some((c) => c.dataset.tag === tag)) this.tag = tag;
      if (q && this.input) {
        this.input.value = q;
        this.query = q;
      }
      this.apply({ silent: true });
    }

    apply({ silent = false } = {}) {
      const q = this.query.trim();

      const matches = this.index
        .map((entry) => {
          if (this.tag !== "all" && !entry.tags.includes(this.tag)) return null;
          if (!q) return { entry, score: 0 };
          const hit = fuzzyMatch(q, entry.haystack);
          return hit ? { entry, score: hit.score } : null;
        })
        .filter(Boolean)
        // Relevance first when searching; original order otherwise.
        .sort((a, b) => (q ? b.score - a.score : 0));

      const slides = matches.map((m) => m.entry.slide);

      this.chips.forEach((chip) => {
        const on = chip.dataset.tag === this.tag;
        chip.classList.toggle("active", on);
        chip.setAttribute("aria-pressed", String(on));
      });

      const total = this.index.length;
      if (this.countEl) {
        this.countEl.textContent =
          slides.length === total
            ? `${total} projects`
            : `${slides.length} of ${total}`;
      }
      this.emptyEl?.toggleAttribute("hidden", slides.length > 0);
      this.el
        .closest(".projects")
        ?.classList.toggle("is-empty", slides.length === 0);

      if (slides.length) this.carousel.setVisible(slides);

      // Shareable state, without adding history entries on every keystroke.
      const params = new URLSearchParams(location.search);
      this.tag === "all" ? params.delete("tag") : params.set("tag", this.tag);
      q ? params.set("q", q) : params.delete("q");
      const search = params.toString();
      history.replaceState(
        null,
        "",
        `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
      );

      if (!silent) {
        Announcer.say(
          slides.length
            ? `${slides.length} project${slides.length === 1 ? "" : "s"} shown`
            : "No projects match that search",
        );
      }
    }
  }

  /* ===========================================================================
   * 25 — CommandPalette (⌘K / Ctrl-K)
   *
   * The whole UI is built in JS — nothing ships in the HTML — and the action
   * list is *derived from the page*: every section heading becomes a jump
   * command and every project slide becomes an open command, so the palette
   * cannot drift out of sync with the content.
   *
   * Ranking runs the shared fuzzy matcher over title + keywords, then applies a
   * recency boost from the last five executed commands. Matched characters are
   * highlighted from the returned index list.
   *
   * Accessibility: combobox pattern with aria-activedescendant, roving virtual
   * focus (the input keeps real focus so typing never breaks), focus trap,
   * inert background, scroll lock, and focus restored to the trigger on close.
   * ======================================================================== */

  const MAX_RESULTS = 8;

  class CommandPalette extends Module {
    static selector = null;

    mount() {
      this.open = false;
      this.actions = [];
      this.results = [];
      this.cursor = 0;
      this.recent = Store.get("recent-commands", []);
      this.build();
      this.collectActions();

      this.on(document, "keydown", (e) => {
        const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
        const slash =
          e.key === "/" &&
          !/^(input|textarea)$/i.test(document.activeElement?.tagName || "");
        if (combo || slash) {
          e.preventDefault();
          this.toggle();
          return;
        }
        if (e.key === "Escape" && this.open) {
          e.preventDefault();
          this.close();
        }
      });

      qsa("[data-cmdk-open]").forEach((btn) =>
        this.on(btn, "click", () => this.toggle()),
      );
    }

    /* --- DOM ------------------------------------------------------------ */

    build() {
      // Remounting (the reduced-motion toggle destroys and rebuilds every
      // module) must not leave a second palette behind.
      qsa(".cmdk, .cmdk-toast").forEach((n) => n.remove());

      const root = document.createElement("div");
      root.className = "cmdk";
      root.hidden = true;
      root.innerHTML = `
        <div class="cmdk-scrim" data-cmdk-scrim></div>
        <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
          <div class="cmdk-field">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="text" class="cmdk-input" role="combobox" aria-expanded="true"
                   aria-controls="cmdk-list" aria-autocomplete="list" autocomplete="off"
                   spellcheck="false" placeholder="Jump to a section, project or link…"
                   aria-label="Search commands">
            <kbd class="cmdk-esc">esc</kbd>
          </div>
          <ul class="cmdk-list" id="cmdk-list" role="listbox" aria-label="Commands"></ul>
          <div class="cmdk-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>`;
      document.body.appendChild(root);
      this.cleanup(() => {
        document.body.classList.remove("cmdk-open");
        this._release?.();
        root.remove();
      });

      this.root = root;
      this.input = qs(".cmdk-input", root);
      this.list = qs(".cmdk-list", root);

      this.on(qs("[data-cmdk-scrim]", root), "click", () => this.close());
      this.on(this.input, "input", () => {
        this.cursor = 0;
        this.render();
      });
      this.on(this.input, "keydown", (e) => this.onKeydown(e));
      // Pointer selection keeps the virtual cursor in sync with the mouse.
      this.on(this.list, "pointermove", (e) => {
        const item = e.target.closest(".cmdk-item");
        if (!item) return;
        const i = Number(item.dataset.i);
        if (i !== this.cursor) {
          this.cursor = i;
          this.paintCursor();
        }
      });
      this.on(this.list, "click", (e) => {
        const item = e.target.closest(".cmdk-item");
        if (item) this.execute(this.results[Number(item.dataset.i)]);
      });
    }

    /* --- actions, derived from the live DOM ------------------------------ */

    collectActions() {
      const add = (action) => this.actions.push(action);

      qsa('.navbar .menu a[href^="#"]').forEach((link) => {
        const id = link.getAttribute("href");
        add({
          id: `nav${id}`,
          title: link.textContent.trim(),
          group: "Navigate",
          icon: "fa-arrow-right",
          keywords: `section jump ${id.slice(1)}`,
          run: () => {
            const target = qs(id);
            if (target)
              SmoothScroll.to(target).then(() =>
                history.replaceState(null, "", id),
              );
          },
        });
      });

      qsa("[data-carousel] .pf-slide").forEach((slide) => {
        const title = qs(".text", slide)?.textContent.trim();
        const href = qs("a[href]", slide)?.href;
        if (!title || !href) return;
        add({
          id: `proj:${title}`,
          title,
          subtitle: "Open project",
          group: "Projects",
          icon: "fa-code-branch",
          keywords: `project repository ${slide.dataset.tags || ""}`,
          run: () => window.open(href, "_blank", "noopener"),
        });
      });

      qsa(".contact-content a[href], .project-featured a[href]").forEach(
        (link) => {
          const label = link.textContent.trim().replace(/\s+/g, " ");
          if (!label) return;
          const icon =
            qs("i", link)?.className.match(/fa-[a-z-]+/)?.[0] ||
            "fa-external-link-alt";
          add({
            id: `link:${link.href}`,
            title: label,
            subtitle: new URL(link.href).hostname.replace("www.", ""),
            group: "Links",
            icon,
            keywords: "contact social profile open",
            run: () => window.open(link.href, "_blank", "noopener"),
          });
        },
      );

      add({
        id: "copy-email",
        title: "Copy email address",
        subtitle: "tanmoybiswas478@gmail.com",
        group: "Actions",
        icon: "fa-envelope",
        keywords: "clipboard mail contact",
        run: async () => {
          try {
            await navigator.clipboard.writeText("tanmoybiswas478@gmail.com");
            Announcer.say("Email address copied to clipboard");
            this.flash("Copied to clipboard");
          } catch {
            this.flash("Copy failed — clipboard blocked");
          }
        },
      });

      add({
        id: "copy-link",
        title: "Copy link to this page",
        group: "Actions",
        icon: "fa-link",
        keywords: "share url clipboard",
        run: async () => {
          try {
            await navigator.clipboard.writeText(location.href);
            this.flash("Link copied");
          } catch {
            this.flash("Copy failed");
          }
        },
      });

      add({
        id: "toggle-motion",
        title: "Toggle reduced motion",
        subtitle: "Disable animations and the particle field",
        group: "Actions",
        icon: "fa-universal-access",
        keywords: "accessibility animation a11y prefers reduced",
        run: () => {
          const reduced = Motion.toggle();
          this.flash(reduced ? "Reduced motion on" : "Reduced motion off");
          Announcer.say(reduced ? "Animations disabled" : "Animations enabled");
        },
      });

      add({
        id: "toggle-stats",
        title: "Toggle performance monitor",
        subtitle: "Live frame time and particle count",
        group: "Actions",
        icon: "fa-gauge-high",
        keywords: "fps debug performance devtools",
        run: () => document.documentElement.classList.toggle("show-stats"),
      });

      add({
        id: "top",
        title: "Back to top",
        group: "Navigate",
        icon: "fa-chevron-up",
        keywords: "scroll home start",
        run: () => SmoothScroll.to(0),
      });
    }

    /* --- ranking -------------------------------------------------------- */

    search(query) {
      const q = query.trim();
      if (!q) {
        // Empty query: recents first, then source order.
        const ranked = [...this.actions].sort((a, b) => {
          const ai = this.recent.indexOf(a.id);
          const bi = this.recent.indexOf(b.id);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        return ranked
          .slice(0, MAX_RESULTS)
          .map((action) => ({ action, indices: [] }));
      }

      return this.actions
        .map((action) => {
          const hit = fuzzyMatch(q, action.title);
          const alt = hit
            ? null
            : fuzzyMatch(q, `${action.title} ${action.keywords || ""}`);
          if (!hit && !alt) return null;
          const recencyBoost =
            Math.max(0, 5 - this.recent.indexOf(action.id)) *
            (this.recent.includes(action.id) ? 2 : 0);
          return {
            action,
            indices: hit ? hit.indices : [],
            score: (hit ? hit.score + 10 : alt.score) + recencyBoost,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);
    }

    render() {
      this.results = this.search(this.input.value);
      this.cursor = clamp(this.cursor, 0, Math.max(0, this.results.length - 1));

      if (!this.results.length) {
        this.list.innerHTML = `<li class="cmdk-empty" role="option" aria-disabled="true">No matches for “${this.input.value.replace(
          /[<>&]/g,
          "",
        )}”</li>`;
        this.input.removeAttribute("aria-activedescendant");
        return;
      }

      let lastGroup = null;
      this.list.innerHTML = this.results
        .map(({ action, indices }, i) => {
          const header =
            action.group !== lastGroup
              ? `<li class="cmdk-group" role="presentation">${action.group}</li>`
              : "";
          lastGroup = action.group;
          return `${header}
          <li class="cmdk-item" role="option" id="cmdk-opt-${i}" data-i="${i}" aria-selected="false">
            <i class="fas ${action.icon} cmdk-icon" aria-hidden="true"></i>
            <span class="cmdk-labels">
              <span class="cmdk-title">${highlight(action.title, indices)}</span>
              ${action.subtitle ? `<span class="cmdk-sub">${action.subtitle}</span>` : ""}
            </span>
            <i class="fas fa-arrow-turn-down cmdk-enter" aria-hidden="true"></i>
          </li>`;
        })
        .join("");
      this.paintCursor();
    }

    paintCursor() {
      qsa(".cmdk-item", this.list).forEach((item) => {
        const on = Number(item.dataset.i) === this.cursor;
        item.classList.toggle("active", on);
        item.setAttribute("aria-selected", String(on));
        if (on) {
          this.input.setAttribute("aria-activedescendant", item.id);
          item.scrollIntoView({ block: "nearest" });
        }
      });
    }

    onKeydown(e) {
      const n = this.results.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          this.cursor = mod(this.cursor + 1, n);
          this.paintCursor();
          break;
        case "ArrowUp":
          e.preventDefault();
          this.cursor = mod(this.cursor - 1, n);
          this.paintCursor();
          break;
        case "Home":
          e.preventDefault();
          this.cursor = 0;
          this.paintCursor();
          break;
        case "End":
          e.preventDefault();
          this.cursor = n - 1;
          this.paintCursor();
          break;
        case "Enter":
          e.preventDefault();
          this.execute(this.results[this.cursor]);
          break;
        case "Tab":
          if (n) {
            e.preventDefault();
            this.cursor = mod(this.cursor + (e.shiftKey ? -1 : 1), n);
            this.paintCursor();
          }
          break;
      }
    }

    execute(result) {
      if (!result) return;
      const { action } = result;
      this.recent = [
        action.id,
        ...this.recent.filter((id) => id !== action.id),
      ].slice(0, 5);
      Store.set("recent-commands", this.recent);
      this.close();
      // Let the closing transition start before the action moves the page.
      requestAnimationFrame(() => {
        try {
          action.run();
        } catch (err) {
          console.error(err);
        }
      });
    }

    flash(message) {
      const toast = document.createElement("div");
      toast.className = "cmdk-toast";
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("in"));
      setTimeout(() => {
        toast.classList.remove("in");
        toast.addEventListener("transitionend", () => toast.remove(), {
          once: true,
        });
        setTimeout(() => toast.remove(), 600);
      }, 1900);
    }

    /* --- open / close --------------------------------------------------- */

    toggle() {
      this.open ? this.close() : this.show();
    }

    show() {
      if (this.open) return;
      this.open = true;
      this.scrollY = window.scrollY;
      this.root.hidden = false;
      document.body.classList.add("cmdk-open");
      this.input.value = "";
      this.cursor = 0;
      this.render();
      requestAnimationFrame(() => {
        this.root.classList.add("in");
        this.input.focus();
      });
      this._release = trapFocus(this.root);
      Announcer.say("Command palette opened");
    }

    close() {
      if (!this.open) return;
      this.open = false;
      this.root.classList.remove("in");
      document.body.classList.remove("cmdk-open");
      this._release?.();
      this._release = null;
      const hide = () => {
        if (!this.open) this.root.hidden = true;
      };
      this.root.addEventListener("transitionend", hide, { once: true });
      setTimeout(hide, 320);
    }
  }

  /* ===========================================================================
   * 26 — StatsMonitor: live frame cost, toggled from the palette
   * ======================================================================== */

  class StatsMonitor extends Module {
    static selector = null;

    mount() {
      qsa(".stats-monitor").forEach((n) => n.remove()); // idempotent across remounts
      const el = document.createElement("div");
      el.className = "stats-monitor";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
      this.cleanup(() => el.remove());

      let acc = 0;
      this.frame((dt) => {
        acc += dt * 16.67;
        if (acc < 250) return;
        acc = 0;
        if (!document.documentElement.classList.contains("show-stats")) return;
        const field = Registry.instances.find(
          (m) => m instanceof ParticleField,
        );
        const fps = Math.round(1000 / kernel.frameMs);
        el.textContent =
          `${fps} fps · ${kernel.frameMs.toFixed(1)}ms · ${kernel.tasks.size} tasks` +
          (field?.particles
            ? ` · ${field.particles.length} nodes @ q${field.quality.toFixed(2)}`
            : "");
      });
    }
  }

  /* ===========================================================================
   * 27 — LazyMedia: decode images off-thread, then fade them in
   * ======================================================================== */

  class LazyMedia extends Module {
    static selector = null;

    mount() {
      qsa("img").forEach(async (img) => {
        img.classList.add("img-fade");
        const done = () => img.classList.add("loaded");
        if (img.complete && img.naturalWidth) {
          done();
          return;
        }
        try {
          await img.decode();
          done();
        } catch {
          this.on(img, "load", done);
          this.on(img, "error", done);
        }
      });
    }
  }

  /* ===========================================================================
   * 28 — Boot
   *
   * Order matters in exactly one place: ProjectFilter looks up the mounted
   * Carousel instance, so it is registered after it. Everything else is
   * independent. Toggling reduced motion at runtime tears the whole registry
   * down and remounts it, which is how a module that opted out of animating at
   * mount time can come back to life without a page reload.
   * ======================================================================== */

  const MODULES = [
    Reveal,
    Counters,
    Navigation,
    ScrollProgress,
    Typewriter,
    CustomCursor,
    Magnetic,
    Spotlight,
    HeroParallax,
    ParticleField,
    Timeline,
    Carousel,
    ProjectFilter, // filter must follow the carousel
    CommandPalette,
    StatsMonitor,
    LazyMedia,
  ];

  function boot() {
    const t0 = performance.now();

    Motion.init();
    Viewport.init();
    Pointer.init();
    Announcer.init();

    Registry.define(...MODULES).mountAll();

    // Reveal the page only once modules are wired, to avoid a flash of
    // un-animated content.
    document.documentElement.classList.add("js-ready");

    let remounting = false;
    Motion.subscribe(() => {
      if (remounting) return;
      remounting = true;
      requestAnimationFrame(() => {
        Registry.destroyAll();
        Registry.mountAll();
        Viewport.measure();
        remounting = false;
      });
    });

    console.info(
      `%c Portfolio %c ${Registry.instances.length} modules in ${(performance.now() - t0).toFixed(1)}ms `,
      "background:#4C8DFF;color:#050914;font-weight:700;border-radius:3px 0 0 3px",
      "background:#0f1e3a;color:#7FB4FF;border-radius:0 3px 3px 0",
    );
    console.info(
      "%cPress ⌘K / Ctrl-K to open the command palette.",
      "color:#7C8AA5",
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  /* Public surface — handy for debugging from the console. */
  return {
    SUPPORTS,
    Motion,
    Viewport,
    Pointer,
    kernel,
    Registry,
    Store,
    SmoothScroll,
    Spring,
    fuzzyMatch,
    get modules() {
      return Registry.instances;
    },
    find: (name) => Registry.instances.find((m) => m.constructor.name === name),
  };
})();

if (typeof window !== "undefined") window.Portfolio = Portfolio;
