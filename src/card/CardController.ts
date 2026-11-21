import type { MarketCountry } from '../data/types';
import type { ScreenPoint } from '../shared/coords';
import { icon } from '../ui/icons';
import { computeCardPosition } from './position';
import type {
  CardActions,
  CardContentHandle,
  CardContentRenderer,
  CardMode,
  CardRenderContext,
} from './types';

export type CardCloseReason = 'close-button' | 'escape' | 'dismiss' | 'external';

export interface CardControllerOptions {
  renderer: CardContentRenderer;
  /** Fired whenever a card becomes pinned. The app selects/focuses the country. */
  onPinned?: (country: MarketCountry) => void;
  onClose?: (reason: CardCloseReason) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

/**
 * Owns *card behaviour*: layout, show/hide, pinning, hover, focus and a11y.
 *
 * It deliberately knows nothing about what a card says. Content is delegated
 * to a `CardContentRenderer`; the shell only creates a body node, inserts the
 * renderer's element, and calls `update`/`destroy` on it.
 */
export class CardController {
  private readonly root: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly body: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver | null;

  private renderer: CardContentRenderer;
  private handle: CardContentHandle | null = null;
  private country: MarketCountry | null = null;
  private mode: CardMode = 'preview';
  private anchor: ScreenPoint = { x: 0, y: 0 };
  private pointerInside = false;

  private readonly actions: CardActions = {
    close: () => this.close('close-button'),
    pin: () => this.pinFromContent(),
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly options: CardControllerOptions,
  ) {
    this.renderer = options.renderer;
    this.root = document.createElement('aside');
    this.root.className = 'country-card';
    this.root.hidden = true;
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'false');
    this.root.innerHTML = `
      <div class="country-card__surface">
        <div class="country-card__bar">
          <span class="country-card__status">
            <span class="country-card__dot" aria-hidden="true"></span>
            <span data-ref="status">悬停预览</span>
          </span>
          <button class="country-card__close" type="button" data-ref="close" aria-label="关闭卡片"></button>
        </div>
        <div class="country-card__body" data-ref="body"></div>
        <div class="country-card__foot">
          <span data-ref="hint"></span>
        </div>
      </div>`;

    this.surface = mustQuery(this.root, '.country-card__surface');
    this.body = mustQuery(this.root, '[data-ref="body"]');
    this.statusEl = mustQuery(this.root, '[data-ref="status"]');
    this.hintEl = mustQuery(this.root, '[data-ref="hint"]');
    this.closeButton = mustQuery<HTMLButtonElement>(this.root, '[data-ref="close"]');
    this.closeButton.append(icon('close'));

    this.root.addEventListener('pointerenter', this.onPointerEnter);
    this.root.addEventListener('pointerleave', this.onPointerLeave);
    this.closeButton.addEventListener('click', this.onCloseClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (this.isOpen) this.place(this.anchor);
          });
    this.resizeObserver?.observe(this.surface);

    this.host.append(this.root);
  }

  /** Show a hover preview, or move an existing one to the pointer. */
  openPreview(country: MarketCountry, point: ScreenPoint): void {
    if (this.isPinned) return;

    const wasOpen = this.isOpen;
    const sameCountry = this.country?.id === country.id;
    this.country = country;
    this.mode = 'preview';
    this.anchor = point;
    this.root.hidden = false;

    // Reuse one reveal path for both modes. Replaying only on country change
    // meant a card that had been closed while the dossier opened could be
    // re-shown without its entrance animation.
    if (!wasOpen || !sameCountry || !this.handle) {
      this.mountContent();
    }
    // One animation path for both the default and sidebar-open modes.
    this.playReveal();
    this.syncChrome();
    this.place(point);
  }

  /** Pin a country card at the click point. Idempotent for the same country. */
  pin(country: MarketCountry, point: ScreenPoint): void {
    const sameCountry = this.country?.id === country.id;
    this.country = country;
    this.mode = 'pinned';
    this.anchor = point;
    this.root.hidden = false;

    if (!sameCountry || !this.handle) {
      this.mountContent();
    } else {
      this.updateContent();
    }

    this.syncChrome();
    this.place(point);
    this.root.focus({ preventScroll: true });
    this.options.onPinned?.(country);
  }

  /** Move a preview with the pointer. Pinned cards stay anchored. */
  moveTo(point: ScreenPoint): void {
    if (!this.isOpen || this.isPinned) return;
    this.place(point);
  }

  /** Hide the hover preview, unless the pointer is currently inside the card. */
  dismissPreview(): boolean {
    if (!this.isOpen || this.isPinned || this.pointerInside) return false;
    this.close('dismiss');
    return true;
  }

  close(reason: CardCloseReason = 'external'): void {
    if (!this.isOpen) return;

    this.handle?.destroy?.();
    this.handle = null;
    this.country = null;
    this.mode = 'preview';
    this.pointerInside = false;
    this.root.hidden = true;
    this.root.removeAttribute('data-mode');
    this.options.onClose?.(reason);
  }

  /** Swap the content renderer while keeping the current card open. */
  setRenderer(renderer: CardContentRenderer): void {
    this.renderer = renderer;
    if (!this.isOpen) return;
    this.mountContent();
    this.syncChrome();
    this.place(this.anchor);
  }

  get isOpen(): boolean {
    return this.country !== null && !this.root.hidden;
  }

  get isPinned(): boolean {
    return this.isOpen && this.mode === 'pinned';
  }

  get isPreview(): boolean {
    return this.isOpen && this.mode === 'preview';
  }

  get countryId(): string | null {
    return this.country?.id ?? null;
  }

  get rendererId(): string {
    return this.renderer.id;
  }

  destroy(): void {
    this.close('external');
    this.root.removeEventListener('pointerenter', this.onPointerEnter);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.closeButton.removeEventListener('click', this.onCloseClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.root.remove();
  }

  private playReveal(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.surface.getAnimations().forEach((animation) => animation.cancel());
    this.surface.animate(
      [
        { opacity: 0, transform: 'translateY(7px) scale(0.988)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: 200,
        easing: 'cubic-bezier(0.16, 0.84, 0.32, 1)',
      },
    );
  }

  private mountContent(): void {
    this.handle?.destroy?.();
    this.handle = null;
    this.body.replaceChildren();
    if (!this.country) return;

    try {
      const handle = this.renderer.create(this.context());
      this.handle = handle;
      this.body.append(handle.element);
      this.root.dataset.renderer = this.renderer.id;
    } catch (error) {
      console.error('[card] renderer failed', error);
      const fallback = document.createElement('p');
      fallback.className = 'card-error';
      fallback.textContent = '卡片内容渲染失败，请查看控制台。';
      this.body.append(fallback);
    }
  }

  private updateContent(): void {
    if (!this.country) return;
    if (!this.handle) {
      this.mountContent();
      return;
    }
    if (this.handle.update) {
      this.handle.update(this.context());
    } else {
      this.mountContent();
    }
  }

  private pinFromContent(): void {
    if (!this.country || !this.isOpen || this.isPinned) return;
    this.pin(this.country, this.anchor);
  }

  private context(): CardRenderContext {
    if (!this.country) {
      throw new Error('Card content requested without a country');
    }
    return {
      country: this.country,
      mode: this.mode,
      actions: this.actions,
    };
  }

  private syncChrome(): void {
    if (!this.country) return;
    const pinned = this.mode === 'pinned';

    this.root.dataset.mode = this.mode;
    this.root.setAttribute(
      'aria-label',
      `${this.country.nameZh}${pinned ? '，已固定的市场卡片' : '，国家档案预览'}`,
    );
    this.statusEl.textContent = pinned ? '已固定' : '悬停预览';
    this.hintEl.textContent = pinned
      ? '按 Esc 或点击地球空白处关闭'
      : '点击查看完整档案';
    this.closeButton.setAttribute('aria-label', `关闭${this.country.nameZh}市场卡片`);
  }

  private place(point: ScreenPoint): void {
    if (!this.isOpen) return;
    this.anchor = point;

    const rect = this.surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const placement = computeCardPosition(
      point,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
      { offset: 34 },
    );

    this.root.style.setProperty('--card-x', `${Math.round(placement.x)}px`);
    this.root.style.setProperty('--card-y', `${Math.round(placement.y)}px`);
    this.root.dataset.edge = placement.horizontal;
  }

  private readonly onPointerEnter = (): void => {
    this.pointerInside = true;
    this.options.onPointerEnter?.();
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.options.onPointerLeave?.();
  };

  private readonly onCloseClick = (event: MouseEvent): void => {
    event.preventDefault();
    this.close('close-button');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.isOpen) return;
    event.preventDefault();
    this.close('escape');
  };

  private readonly onResize = (): void => {
    if (this.isOpen) this.place(this.anchor);
  };
}

function mustQuery<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Card shell is missing ${selector}`);
  return node;
}
