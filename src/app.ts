import worldTopology from 'world-atlas/countries-50m.json';
import { CardController } from './card/CardController';
import { resolveCardRenderer } from './card/registry';
import { siteConfig } from './config';
import { MarketRepository } from './data/MarketRepository';
import type { MarketCountry } from './data/types';
import { buildCountries, type WorldAtlasTopology } from './globe/geo';
import { GlobeScene } from './globe/GlobeScene';
import type { CountryShape, GlobeCountryEvent, GlobeHoverEvent } from './globe/types';
import type { ScreenPoint } from './shared/coords';
import { hideLoader, showToast } from './ui/loader';
import { mountStarfield } from './ui/starfield';

const PREVIEW_DISMISS_DELAY = 180;

/**
 * Composition root. Market data decides which country shapes exist at all:
 * only the OIC 57-country scope is rendered, highlighted and interactive.
 */
export async function createApp(): Promise<void> {
  const globeEl = requireElement<HTMLElement>('#globe');
  const cardHost = requireElement<HTMLElement>('#card-layer');
  const starfieldEl = requireElement<HTMLCanvasElement>('#starfield');
  const countEl = document.querySelector<HTMLElement>('[data-ref="market-count"]');
  const focusCountEl = document.querySelector<HTMLElement>('[data-ref="focus-count"]');
  const otherCountEl = document.querySelector<HTMLElement>('[data-ref="oic-count"]');

  const cleanupStarfield = mountStarfield(starfieldEl);
  const repository = new MarketRepository(siteConfig.data.marketUrl);
  await repository.load();

  const shapes = buildCountries(worldTopology as unknown as WorldAtlasTopology);
  const shapeById = new Map<string, CountryShape>();
  const marketByShapeId = new Map<string, MarketCountry>();
  const marketShapes = shapes.filter((shape) => {
    const market = repository.resolve(shape);
    if (!market) return false;
    shapeById.set(shape.id, shape);
    marketByShapeId.set(shape.id, market);
    return true;
  });

  if (marketShapes.length === 0) {
    throw new Error('市场数据没有匹配到任何地图边界');
  }

  const focusIds = repository.focusIds;
  const focusCount = focusIds.size;
  const marketCount = marketShapes.length;

  if (countEl) countEl.textContent = `${marketCount} 个 OIC 市场`;
  if (focusCountEl) focusCountEl.textContent = `重点样本 ${focusCount}`;
  if (otherCountEl) otherCountEl.textContent = `OIC 其他 ${marketCount - focusCount}`;

  const missingShapes = repository.list().filter((market) => !shapeById.has(market.id));
  if (missingShapes.length > 0) {
    console.warn(
      '[markets] missing map geometry:',
      missingShapes.map((market) => `${market.iso3}/${market.nameZh}`).join(', '),
    );
    showToast(`${missingShapes.length} 个市场缺少地图边界，未显示在地球上。`);
  }

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

  let resolveSceneReady: () => void = () => undefined;
  const sceneReady = new Promise<void>((resolve) => {
    resolveSceneReady = resolve;
  });

  const scene = new GlobeScene({
    container: globeEl,
    countries: marketShapes,
    focusIds,
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

  card = new CardController(cardHost, {
    renderer: resolveCardRenderer(siteConfig.cardRenderer),
    onPinned: (market) => {
      scene.setSelected(market.id);
      const shape = shapeById.get(market.id);
      if (shape) scene.focusCountry(shape);
    },
    onClose: () => {
      scene.setSelected(null);
    },
    onPointerEnter: cancelDismiss,
    onPointerLeave: () => scheduleDismiss(PREVIEW_DISMISS_DELAY + 60),
  });

  function marketFor(shape: CountryShape): MarketCountry | null {
    return marketByShapeId.get(shape.id) ?? null;
  }

  function handleHover(event: GlobeHoverEvent): void {
    if (!card) return;
    if (!event.country) {
      scheduleDismiss();
      return;
    }

    cancelDismiss();
    if (card.isPinned) return;
    const market = marketFor(event.country);
    if (market) card.openPreview(market, event.point);
  }

  function handleCountryClick(event: GlobeCountryEvent): void {
    if (!card) return;
    const market = marketFor(event.country);
    if (!market) return;
    cancelDismiss();
    lastCountryClickAt = performance.now();
    card.pin(market, event.point);
  }

  function handleBackgroundClick(): void {
    if (!card) return;
    if (performance.now() - lastCountryClickAt < 300) return;
    if (card.isOpen) card.close('external');
  }

  function handlePointerMove(point: ScreenPoint): void {
    if (!card?.isPreview) return;
    card.moveTo(point);
  }

  await Promise.race([sceneReady, delay(5000)]);
  hideLoader();

  if (import.meta.env.DEV) {
    console.info(
      `[markets] ${marketCount} OIC markets (${focusCount} focus) · renderer="${siteConfig.cardRenderer}" · data="${repository.meta?.scope ?? 'unknown'}"`,
    );
  }

  window.addEventListener('pagehide', () => {
    cleanupStarfield();
    card?.destroy();
    scene.destroy();
  }, { once: true });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
