import worldTopology from 'world-atlas/countries-50m.json';
import { CardController } from './card/CardController';
import { resolveCardRenderer } from './card/registry';
import { ChinaHover } from './china/ChinaHover';
import { siteConfig } from './config';
import { MarketRepository } from './data/MarketRepository';
import { ProfileRepository } from './data/ProfileRepository';
import type { MarketCountry } from './data/types';
import { buildCountries, type WorldAtlasTopology } from './globe/geo';
import { GlobeScene } from './globe/GlobeScene';
import type { CountryShape, GlobeCountryEvent, GlobeHoverEvent, TradeArc } from './globe/types';
import { SearchController } from './search/SearchController';
import { SidebarController } from './sidebar/SidebarController';
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
  const overlayHost = requireElement<HTMLElement>('#overlay-layer');
  const searchButton = document.querySelector<HTMLButtonElement>('[data-ref="search-open"]');
  const starfieldEl = requireElement<HTMLCanvasElement>('#starfield');
  const countEl = document.querySelector<HTMLElement>('[data-ref="market-count"]');
  const focusCountEl = document.querySelector<HTMLElement>('[data-ref="focus-count"]');
  const otherCountEl = document.querySelector<HTMLElement>('[data-ref="oic-count"]');

  const cleanupStarfield = mountStarfield(starfieldEl);
  const repository = new MarketRepository(siteConfig.data.marketUrl);
  const profileRepository = new ProfileRepository(siteConfig.data.profileUrl);
  await Promise.all([repository.load(), profileRepository.load()]);

  for (const market of repository.list()) {
    const profile = profileRepository.get(market.iso3);
    if (profile) market.profile = profile;
  }

  const shapes = buildCountries(worldTopology as unknown as WorldAtlasTopology);
  const chinaShape = shapes.find((shape) => shape.id === '156') ?? null;
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
    china: chinaShape,
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

  const chinaHover = new ChinaHover(overlayHost);
  const sidebar = new SidebarController(overlayHost, {
    onClose: () => {
      scene.setSelected(null);
      scene.setArcs([]);
    },
  });
  const search = new SearchController(overlayHost, {
    onSelect: (market) => {
      openDossier(market);
    },
  });
  search.setData(repository.list());
  searchButton?.addEventListener('click', () => search.open());

  card = new CardController(cardHost, {
    renderer: resolveCardRenderer(siteConfig.cardRenderer),
    onClose: () => {
      // Selection is owned by the dossier, not the hover card.
      if (!sidebar.isOpen) scene.setSelected(null);
    },
    onPointerEnter: cancelDismiss,
    onPointerLeave: () => scheduleDismiss(PREVIEW_DISMISS_DELAY + 60),
  });

  function marketFor(shape: CountryShape): MarketCountry | null {
    return marketByShapeId.get(shape.id) ?? null;
  }

  function pointForMarket(market: MarketCountry): { lat: number; lng: number } | null {
    const city = market.profile?.cities[0];
    if (city?.lat != null && city.lng != null) return { lat: city.lat, lng: city.lng };
    const shape = shapeById.get(market.id);
    return shape?.centroid ?? null;
  }

  function arcForMarket(market: MarketCountry): TradeArc | null {
    const point = pointForMarket(market);
    const value =
      (market.chinaTrade?.exports?.value ?? 0) + (market.chinaTrade?.imports?.value ?? 0);
    if (!point || value <= 0) return null;
    return {
      startLat: 31.2,
      startLng: 121.5,
      endLat: point.lat,
      endLng: point.lng,
      color: ['rgba(255, 209, 138, 0.72)', 'rgba(255, 126, 92, 0.28)'],
      width: 0.35,
      value,
    };
  }

  function chinaArcs(): TradeArc[] {
    return repository
      .list()
      .map((market): TradeArc | null => {
        const point = pointForMarket(market);
        const value =
          (market.chinaTrade?.exports?.value ?? 0) +
          (market.chinaTrade?.imports?.value ?? 0);
        if (!point || value <= 0) return null;
        return {
          startLat: 31.2,
          startLng: 121.5,
          endLat: point.lat,
          endLng: point.lng,
          color: ['rgba(255, 102, 90, 0.34)', 'rgba(255, 184, 120, 0.04)'],
          width: 0.08 + Math.min(0.32, Math.log10(value) / 45),
          value,
        } satisfies TradeArc;
      })
      .filter((arc): arc is TradeArc => arc != null);
  }

  function openDossier(market: MarketCountry): void {
    cancelDismiss();
    card?.close('external');
    chinaHover.close();
    scene.setHubs([]);
    sidebar.open(market);
    scene.setSelected(market.id);
    const shape = shapeById.get(market.id);
    if (shape) scene.focusCountry(shape);
    const arc = arcForMarket(market);
    scene.setArcs(arc ? [arc] : []);
    search.close();
  }

  function handleHover(event: GlobeHoverEvent): void {
    if (!card || sidebar.isOpen) return;
    if (!event.country) {
      chinaHover.close();
      scene.setHubs([]);
      scheduleDismiss();
      if (!sidebar.isOpen) scene.setArcs([]);
      return;
    }

    if (event.country.id === '156') {
      const china = profileRepository.china;
      if (china) {
        cancelDismiss();
        card.close('external');
        chinaHover.show(china, repository.list(), event.point);
        scene.setArcs(chinaArcs());
        scene.setHubs(china.hubs.filter((hub) => hub.lat != null && hub.lng != null).map((hub) => ({
          lat: hub.lat as number,
          lng: hub.lng as number,
          type: hub.type,
          label: `${hub.type === 'airport' ? '机场' : '港口'} · ${hub.nameZh ?? hub.name}`,
        })));
      }
      return;
    }

    cancelDismiss();
    chinaHover.close();
    if (card.isPinned) return;
    const market = marketFor(event.country);
    if (market) {
      card.openPreview(market, event.point);
      const arc = arcForMarket(market);
      scene.setArcs(arc ? [arc] : []);
      const profile = market.profile;
      scene.setHubs(profile ? profile.hubs.filter((hub) => hub.lat != null && hub.lng != null).map((hub) => ({
        lat: hub.lat as number,
        lng: hub.lng as number,
        type: hub.type,
        label: `${hub.type === 'airport' ? '机场' : '港口'} · ${hub.nameZh ?? hub.name}`,
      })) : []);
    }
  }

  function handleCountryClick(event: GlobeCountryEvent): void {
    if (!card) return;
    if (event.country.id === '156') return; // China is hover-only by requirement.
    const market = marketFor(event.country);
    if (!market) return;
    lastCountryClickAt = performance.now();
    openDossier(market);
  }

  function handleBackgroundClick(): void {
    if (performance.now() - lastCountryClickAt < 300) return;
    chinaHover.close();
    card?.close('external');
    sidebar.close();
    scene.setSelected(null);
    scene.setArcs([]);
    scene.setHubs([]);
  }

  function handlePointerMove(point: ScreenPoint): void {
    if (card?.isPreview) card.moveTo(point);
    if (chinaHover.isOpen) chinaHover.move(point);
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
    sidebar.destroy();
    search.destroy();
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
