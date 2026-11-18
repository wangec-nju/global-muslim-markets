let hideTimer: number | undefined;
let toastTimer: number | undefined;

/** Reveal the UI and fade the boot loader out. */
export function hideLoader(): void {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('is-hidden');
  loader.setAttribute('aria-hidden', 'true');
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    loader.setAttribute('hidden', '');
  }, 600);
}

/** Replace the loader with a readable boot failure instead of a blank page. */
export function failLoader(message: string): void {
  const loader = document.getElementById('loader');
  const title = document.querySelector<HTMLElement>('[data-ref="loader-title"]');
  const sub = document.querySelector<HTMLElement>('[data-ref="loader-sub"]');

  if (title) title.textContent = '3D 地球加载失败';
  if (sub) sub.textContent = message;
  if (!loader) return;

  loader.removeAttribute('hidden');
  loader.removeAttribute('aria-hidden');
  loader.classList.remove('is-hidden');
  loader.classList.add('is-error');
}

export function showToast(message: string, duration = 6000): void {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.hidden = false;
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.hidden = true;
    }, 260);
  }, duration);
}
