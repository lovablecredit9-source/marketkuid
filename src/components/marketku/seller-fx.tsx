import { useEffect } from "react";

/** Colorful ripple on every button/link pressed inside the Seller Center. */
export function useSellerRipple() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".seller-panel :is(button, a, [role='button'])");
      if (!el || (el as HTMLButtonElement).disabled || el.dataset["noRipple"] !== undefined) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const dot = document.createElement("span");
      dot.className = "seller-ripple";
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - r.left - size / 2}px`;
      dot.style.top = `${e.clientY - r.top - size / 2}px`;
      const host = getComputedStyle(el).position === "static";
      if (host) el.classList.add("seller-ripple-host");
      el.classList.add("seller-ripple-clip");
      el.appendChild(dot);
      window.setTimeout(() => {
        dot.remove();
        if (!el.querySelector(".seller-ripple")) el.classList.remove("seller-ripple-clip", "seller-ripple-host");
      }, 650);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
}

const CONFETTI_COLORS = ["var(--primary)", "var(--primary-glow)", "var(--success)", "var(--warning)", "var(--ana-violet)", "var(--destructive)"];

/** Short confetti burst, e.g. after a product is published. */
export function celebrate() {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const host = document.querySelector(".seller-panel") ?? document.body;
  const wrap = document.createElement("div");
  wrap.className = "seller-confetti";
  wrap.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 48; i++) {
    const p = document.createElement("i");
    p.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? "var(--primary)";
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 520}px`);
    p.style.setProperty("--dy", `${-(180 + Math.random() * 320)}px`);
    p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 120}ms`;
    wrap.appendChild(p);
  }
  host.appendChild(wrap);
  window.setTimeout(() => wrap.remove(), 1800);
}
