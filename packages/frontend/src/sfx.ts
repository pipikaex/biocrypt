/**
 * Tiny sound effect helper for BioCrypt.
 *
 * One preloaded HTMLAudioElement per track, cloned on each play so rapid-fire
 * events (fast miners) don't cut each other off. Respects a localStorage-backed
 * mute flag so the Mine page can expose a single toggle.
 */

const MUTE_KEY = "biocrypt.sfx.muted";

const cache = new Map<string, HTMLAudioElement>();

export function isSfxMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* noop */
  }
}

function getAudio(src: string): HTMLAudioElement {
  let base = cache.get(src);
  if (!base) {
    base = new Audio(src);
    base.preload = "auto";
    cache.set(src, base);
  }
  return base;
}

export function playSfx(src: string, volume = 0.5): void {
  if (isSfxMuted()) return;
  try {
    const clone = getAudio(src).cloneNode(true) as HTMLAudioElement;
    clone.volume = Math.max(0, Math.min(1, volume));
    void clone.play().catch(() => { /* autoplay policy / user hasn't interacted yet */ });
  } catch {
    /* noop */
  }
}

export const SFX = {
  coinMined: "/sfx/coin-mined.mp3",
} as const;
