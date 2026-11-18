import worldTopology from 'world-atlas/countries-110m.json';
import { CardController } from './card/CardController';
import {
  isCardRendererId,
  listCardRenderers,
  resolveCardRenderer,
  type CardRendererId,
} from './card/registry';
import { siteConfig } from './config';
import { CountryRepository } from './data/CountryRepository';
import type { CountryDetail } from './data/types';
import { buildCountries, type WorldAtlasTopology } from './globe/geo';
import { GlobeScene } from './globe/GlobeScene';
import type { CountryShape, GlobeHoverEvent, GlobeCountryEvent } from './globe/types';
import type { ScreenPoint } from './shared/coords';
import { hideLoader, showToast } from './ui/loader';
import { mountStarfield } from './ui/starfield';

const RENDERER_QUERY_KEY = 'card';
const PREVIEW_DISMISS_DELAY = 180;

/**
 * Composition root: wires globe events to card behaviour and resolves the
 * country view-model. Neither the scene nor the card shell imports the other.
 */
export async function createApp(): Promise<void> {
  const globeEl = requireElement<HTMLElement>('#globe');
  const cardHost = requireElement<HTMLElement>('#card-layer');
  const starfieldEl = requireElement<HTMLCanvasElement>('#starfield');
  const countEl = document.querySelector<HTMLElement>('[data-ref="country-count"]');

  const countries = buildCountries(worldTopology as unknown as WorldAtlasTopology);
  const shapeById = new Map(countries.map((country) => [country.id, country]));
  const details = new Map<string, CountryDetail>();
  const repository = new CountryRepository(siteConfig.data);

  if (countEl) countEl.textContent = `${countries.length} 个国家与地区`;

  const cleanupStarfield = mountStarfield(starfieldEl);

  let card: CardController | null = null;
  let dismissTimer: number | undefined;
  let lastCountryClickAt = 0;

  const cancelDismiss = (): void => {
    window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
  };

  const scheduleDismiss = (delay = PREVIEW_DISMISS_DELAY): void => {
    cancelDismiss();
    dismissTimer = window.setTimeout(() => {
      dismissTimer = undefined;
      card?.dismissPreview();
    }, delay);
  };

  const detailFor = (shape: CountryShape): CountryDetail => {
    const cached = details.get(shape.id);
    if (cached) return cached;
    const detail = repository.resolve(shape);
    details.set(shape.id, detail);
    return detail;
  };

  const handleHover = (event: GlobeHoverEvent): void => {
    if (!card) return;
    if (!event.country) {
      scheduleDismiss();
      return;
    }

    cancelDismiss();
    if (card.isPinned) return;
    card.openPreview(detailFor(event.country), event.point);
  };

  const handleCountryClick = (event: GlobeCountryEvent): void => {
    if (!card) return;
    cancelDismiss();
    lastCountryClickAt = performance.now();
    card.pin(detailFor(event.country), event.point);
  };

  const handleBackgroundClick = (): void => {
    if (!card) return;
    // Some globe.gl versions still emit onGlobeClick for polygon clicks;
    // ignore the duplicate that follows a country click.
    if (performance.now() - lastCountryClickAt < 300) return;
    if (card.isOpen) card.close('external');
  };

  const handlePointerMove = (point: ScreenPoint): void => {
    if (!card?.isPreview) return;
    card.moveTo(point);
  };

  let resolveSceneReady: () => void = () => undefined;
  const sceneReady = new Promise<void>((resolve) => {
    resolveSceneReady = resolve;
  });

  const scene = new GlobeScene({
    container: globeEl,
    countries,
    textureUrl: siteConfig.globe.textureUrl,
    bumpTextureUrl: siteConfig.globe.bumpTextureUrl,
    initialView: siteConfig.globe.initialView,
    autoRotate: siteConfig.globe.autoRotate,
    autoRotateSpeed: siteConfig.globe.autoRotateSpeed,
    atmosphereColor: siteConfig.globe.atmosphereColor,
    onHover: handleHover,
    onCountryClick: handleCountryClick,
    onBackgroundClick: handleBackgroundClick,
    onPointerMove: handlePointerMove,
    onReady: resolveSceneReady,
  });

  const requestedRenderer = new URLSearchParams(window.location.search).get(
    RENDERER_QUERY_KEY,
  );
  let activeRendererId: CardRendererId = isCardRendererId(requestedRenderer)
    ? requestedRenderer
    : siteConfig.cardRenderer;

  card = new CardController(cardHost, {
    renderer: resolveCardRenderer(activeRendererId),
    onPinned: (country) => {
      scene.setSelected(country.id);
      const shape = shapeById.get(country.id);
      if (shape) scene.focusCountry(shape);
    },
    onClose: () => {
      scene.setSelected(null);
    },
    onPointerEnter: cancelDismiss,
    onPointerLeave: () => scheduleDismiss(PREVIEW_DISMISS_DELAY + 60),
  });

  setupRendererSwitch({
    initialId: activeRendererId,
    onChange: (id) => {
      activeRendererId = id;
      card?.setRenderer(resolveCardRenderer(id));
      updateRendererQuery(id);
      syncRendererSwitch(id);
    },
  });
  syncRendererSwitch(activeRendererId);

  const dataPromise = repository.load();
  const dataReport = await dataPromise;
  details.clear();

  await Promise.race([sceneReady, delay(9000)]);
  hideLoader();

  if (dataReport.errors.length > 0) {
    console.warn('[data]', dataReport.errors.join('\n'));
    showToast('部分数据未能载入，卡片将显示当前可用内容。');
  }

  if (import.meta.env.DEV) {
    console.info(
      `[globe] ${countries.length} countries · renderer="${activeRendererId}" · data: facts=${dataReport.factsLoaded} market=${dataReport.marketLoaded}`,
    );
  }

  window.addEventListener('pagehide', () => {
    cleanupStarfield();
    card?.destroy();
    scene.destroy();
  }, { once: true });
}

interface RendererSwitchOptions {
  initialId: CardRendererId;
  onChange: (id: CardRendererId) => void;
}

function setupRendererSwitch({ initialId, onChange }: RendererSwitchOptions): void {
  const host = document.getElementById('renderer-switch');
  if (!host) return;

  if (!siteConfig.allowRendererSwitch) {
    host.remove();
    return;
  }

  for (const { id, label } of listCardRenderers()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.renderer = id;
    button.textContent = label;
    button.setAttribute('aria-pressed', String(id === initialId));
    host.append(button);
  }

  host.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>('button[data-renderer]');
    if (!button) return;
    const id = button.dataset.renderer;
    if (!isCardRendererId(id) || button.getAttribute('aria-pressed') === 'true') return;
    onChange(id);
  });
}

function syncRendererSwitch(id: CardRendererId): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '#renderer-switch button[data-renderer]',
  );
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.renderer === id));
  }
}

function updateRendererQuery(id: CardRendererId): void {
  try {
    const url = new URL(window.location.href);
    if (id === siteConfig.cardRenderer) {
      url.searchParams.delete(RENDERER_QUERY_KEY);
    } else {
      url.searchParams.set(RENDERER_QUERY_KEY, id);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // file:// previews and some embedded contexts disallow history updates.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
