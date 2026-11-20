import worldTopology from 'world-atlas/countries-50m.json';
import { CardController } from './card/CardController';
import { resolveCardRenderer } from './card/registry';
import { ChinaHover } from './china/ChinaHover';
import { siteConfig } from './config';
import { MarketRepository } from './data/MarketRepository';
import { ProfileRepository } from './data/ProfileRepository';
import type {
  AdminBoundaryDataset,
  MarketCountry,
  MuslimReferenceDataset,
  SeaRouteDataset,
  SeaRouteInfo,
} from './data/types';
import { buildCountries, type WorldAtlasTopology } from './globe/geo';
import { GlobeScene } from './globe/GlobeScene';
import type { CountryShape, GlobeCountryEvent, GlobeHoverEvent } from './globe/types';
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
  let adminBoundaries: AdminBoundaryDataset | null = null;
  let seaRoutes: SeaRouteDataset | null = null;
  const [muslimReference] = await Promise.all([
    fetchJson<MuslimReferenceDataset>(siteConfig.data.muslimReferenceUrl),
    repository.load(),
    profileRepository.load(),
  ]);
  for (const market of repository.list()) {
    const profile = profileRepository.get(market.iso3);
    if (profile) market.profile = profile;
    const reference = muslimReference.countries[market.iso3];
    if (reference) market.muslimReference = reference;
  }

  async function loadGeoData(): Promise<void> {
    try {
      const [admin, sea] = await Promise.all([
        fetchJson<AdminBoundaryDataset>(siteConfig.data.adminBoundaryUrl),
        fetchJson<SeaRouteDataset>(siteConfig.data.seaRouteUrl),
      ]);
      adminBoundaries = admin;
      seaRoutes = sea;
      for (const market of repository.list()) {
        const route = sea.routes[market.iso3];
        if (route) market.seaRoute = route;
      }
    } catch (error) {
      console.error('[geo] failed to load overlays', error);
    }
  }

  function routePaths(route: SeaRouteInfo): Array<{ points: number[][] }> {
    // Map shows the shortest origin per destination; the sidebar lists all 8
    // origins without redrawing hundreds of FatLines on every hover.
    return route.destinations.flatMap((destination) =>
      destination.options[0] ? [{ points: destination.options[0].points }] : [],
    );
  }

  function chinaRoutePaths(): Array<{ points: number[][] }> {
    const top = repository
      .list()
      .map((market) => ({
        market,
        value:
          (market.chinaTrade?.exports?.value ?? 0) +
          (market.chinaTrade?.imports?.value ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return top.flatMap(({ market }) =>
      market.seaRoute
        ? market.seaRoute.destinations.flatMap((destination) =>
            destination.options[0] ? [{ points: destination.options[0].points }] : [],
          )
        : [],
    );
  }

  function highlightColor(market: MarketCountry): string {
    return market.focus ? '#ffe2a8' : '#8ffff0';
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
  let overlayClearTimer: number | undefined;
  let lastCountryClickAt = 0;

  const cancelDismiss = (): void => {
    window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
  };

  const cancelOverlayClear = (): void => {
    window.clearTimeout(overlayClearTimer);
    overlayClearTimer = undefined;
  };

  const scheduleOverlayClear = (delay = 1200): void => {
    cancelOverlayClear();
    overlayClearTimer = window.setTimeout(() => {
      overlayClearTimer = undefined;
      if (card?.isOpen || sidebar.isOpen || chinaHover.isOpen) return;
      scene.setHubs([]);
      scene.clearGeoOverlays();
    }, delay);
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
      scene.clearGeoOverlays();
      scene.setHubs([]);
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
      // Keep the country overlays briefly: a pointer moving over a hub point
      // can produce a null polygon hover, and we must not flicker.
      if (!sidebar.isOpen) {
        scene.setSelected(null);
        scheduleOverlayClear();
      }
    },
    onPointerEnter: cancelDismiss,
    onPointerLeave: () => scheduleDismiss(PREVIEW_DISMISS_DELAY + 60),
  });

  function marketFor(shape: CountryShape): MarketCountry | null {
    return marketByShapeId.get(shape.id) ?? null;
  }

  function openDossier(market: MarketCountry): void {
    cancelDismiss();
    cancelOverlayClear();
    card?.close('external');
    chinaHover.close();
    scene.setHubs([]);
    scene.clearGeoOverlays();
    sidebar.open(market);
    scene.setSelected(market.id);
    const shape = shapeById.get(market.id);
    if (shape) scene.focusCountry(shape);
    search.close();
  }

  function handleHover(event: GlobeHoverEvent): void {
    if (!card || sidebar.isOpen) return;
    if (!event.country) {
      chinaHover.close();
      scheduleDismiss();
      scheduleOverlayClear();
      return;
    }

    if (event.country.id === '156') {
      const china = profileRepository.china;
      if (china) {
        cancelDismiss();
        cancelOverlayClear();
        card.close('external');
        const chinaColor = '#ff8a7f';
        chinaHover.show(china, repository.list(), seaRoutes?.meta.origins ?? [], event.point);
        scene.setGeoOverlays(
          adminBoundaries?.countries.CHN ?? [],
          chinaRoutePaths(),
          chinaColor,
        );
        scene.setHubs(china.hubs.filter((hub) => hub.lat != null && hub.lng != null).map((hub) => ({
          lat: hub.lat as number,
          lng: hub.lng as number,
          type: hub.type,
          label: `${hub.type === 'airport' ? '机场' : hub.type === 'port' ? '港口' : '物流'} · ${hub.nameZh ?? hub.name}`,
        })), chinaColor);
      }
      return;
    }

    cancelDismiss();
    cancelOverlayClear();
    chinaHover.close();
    if (card.isPinned) return;
    const market = marketFor(event.country);
    if (market) {
      const color = highlightColor(market);
      card.openPreview(market, event.point);
      scene.setGeoOverlays(
        adminBoundaries?.countries[market.iso3] ?? [],
        market.seaRoute ? routePaths(market.seaRoute) : [],
        color,
      );
      const profile = market.profile;
      scene.setHubs(profile ? profile.hubs.filter((hub) => hub.lat != null && hub.lng != null).map((hub) => ({
        lat: hub.lat as number,
        lng: hub.lng as number,
        type: hub.type,
        label: `${hub.type === 'airport' ? '机场' : hub.type === 'port' ? '港口' : '物流'} · ${hub.nameZh ?? hub.name}`,
      })) : [], color);
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
    cancelOverlayClear();
    chinaHover.close();
    card?.close('external');
    sidebar.close();
    scene.setSelected(null);
    scene.clearGeoOverlays();
    scene.setHubs([]);
  }

  function handlePointerMove(point: ScreenPoint): void {
    if (card?.isPreview) card.moveTo(point);
    if (chinaHover.isOpen) chinaHover.move(point);
  }

  await Promise.race([sceneReady, delay(5000)]);
  hideLoader();
  // Do not compete with the globe's first paint. Hover cards/hubs remain
  // usable immediately; boundaries and routes arrive on the next idle turn.
  window.setTimeout(() => {
    void loadGeoData();
  }, 120);

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return (await response.json()) as T;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
