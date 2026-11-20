import Globe from 'globe.gl';
import type { GlobeInstance } from 'globe.gl';
import type {
  CountryFeature,
  CountryShape,
  GlobeCountryEvent,
  GlobeHoverEvent,
  GlobeHub,
  GlobePath,
  TradeArc,
} from './types';
import type { InitialView } from '../config';
import type { ScreenPoint } from '../shared/coords';

export interface GlobeSceneOptions {
  container: HTMLElement;
  countries: CountryShape[];
  /** China is rendered separately, red and hover-only. */
  china?: CountryShape | null;
  /** Market ids that should use the stronger focus-sample styling. */
  focusIds?: ReadonlySet<string>;
  textureUrl: string;
  bumpTextureUrl?: string | null;
  initialView: InitialView;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  atmosphereColor?: string;
  reducedMotion?: boolean;
  onHover?: (event: GlobeHoverEvent) => void;
  onCountryClick?: (event: GlobeCountryEvent) => void;
  onBackgroundClick?: () => void;
  onPointerMove?: (point: ScreenPoint) => void;
  onReady?: () => void;
}

const MARKET_CAP = 'rgba(95, 214, 194, 0.11)';
const FOCUS_CAP = 'rgba(233, 185, 107, 0.15)';
const HOVER_CAP = 'rgba(246, 193, 104, 0.55)';
const MARKET_HOVER_CAP = 'rgba(95, 214, 194, 0.5)';
const SELECTED_CAP = 'rgba(235, 169, 81, 0.42)';
const MARKET_SELECTED_CAP = 'rgba(95, 214, 194, 0.4)';
const SELECTED_HOVER_CAP = 'rgba(255, 216, 146, 0.72)';

const MARKET_STROKE = 'rgba(126, 226, 208, 0.62)';
const FOCUS_STROKE = 'rgba(255, 214, 138, 0.86)';
const MARKET_ACTIVE_STROKE = 'rgba(140, 255, 235, 0.98)';
const FOCUS_ACTIVE_STROKE = 'rgba(255, 224, 166, 0.98)';
const SIDE_COLOR = 'rgba(3, 17, 22, 0.78)';
const CHINA_CAP = 'rgba(214, 55, 48, 0.26)';
const CHINA_STROKE = 'rgba(255, 92, 80, 0.95)';
const CHINA_HOVER_CAP = 'rgba(255, 92, 80, 0.52)';

/**
 * Owns the 3D globe and raw pointer interaction. It emits normalized country
 * events with viewport coordinates and has zero knowledge of cards or data.
 */
export class GlobeScene {
  private readonly globe: GlobeInstance;
  private readonly options: GlobeSceneOptions;
  private readonly shapeByFeature = new Map<object, CountryShape>();
  private readonly shapeById = new Map<string, CountryShape>();
  private readonly shapeByFeatureName = new Map<string, CountryShape>();
  private readonly focusIds: ReadonlySet<string>;
  private adminPaths: GlobePath[] = [];
  private seaRoutes: GlobePath[] = [];

  private hovered: CountryShape | null = null;
  private selectedId: string | null = null;
  private pointer: ScreenPoint = { x: 0, y: 0 };
  private pointerDownAt: ScreenPoint | null = null;
  /** False while the pointer is over the header, card, or another overlay. */
  private pointerOnStage = false;
  private dragged = false;
  private styleFrame: number | null = null;
  private resizeFrame: number | null = null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly reducedMotion: boolean;
  private destroyed = false;
  private ready = false;

  constructor(options: GlobeSceneOptions) {
    this.options = options;
    this.focusIds = options.focusIds ?? new Set();
    this.reducedMotion =
      options.reducedMotion ??
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;

    const allShapes = options.china
      ? [...options.countries, options.china]
      : options.countries;
    for (const country of allShapes) {
      this.shapeByFeature.set(country.feature, country);
      this.shapeById.set(country.id, country);
      this.shapeByFeatureName.set(country.name, country);
    }

    const width = options.container.clientWidth || window.innerWidth;
    const height = options.container.clientHeight || window.innerHeight;

    this.globe = new Globe(options.container, {
      // The globe should be interactive immediately: textures are applied in
      // the background instead of gating the whole scene on a 1 MB download.
      animateIn: false,
      waitForGlobeReady: false,
      rendererConfig: { antialias: true, alpha: true },
    });

    this.globe
      .width(width)
      .height(height)
      .backgroundColor('rgba(0, 0, 0, 0)')
      .globeImageUrl(options.textureUrl)
      .showAtmosphere(true)
      .atmosphereColor(options.atmosphereColor ?? '#5fd6c2')
      .atmosphereAltitude(0.16)
      .polygonsData(allShapes.map((country) => country.feature))
      .polygonsTransitionDuration(180)
      .polygonLabel(() => '')
      .polygonAltitude((datum) => this.altitudeFor(datum))
      .polygonCapColor((datum) => this.capColorFor(datum))
      .polygonSideColor(() => SIDE_COLOR)
      .polygonStrokeColor((datum) => this.strokeColorFor(datum))
      .onPolygonHover((datum) => this.handlePolygonHover(datum))
      .onPolygonClick((datum, event) => this.handlePolygonClick(datum, event))
      .onGlobeClick(() => this.handleGlobeClick())
      .onGlobeReady(() => this.handleReady())
      .arcsData([])
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor('color')
      .arcStroke('width')
      .arcDashLength(0.42)
      .arcDashGap(0.24)
      .arcDashAnimateTime(2600)
      .arcsTransitionDuration(0)
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointColor('color')
      .pointRadius('radius')
      .pointAltitude(0.04)
      .pointLabel('label')
      .pointsMerge(false)
      .pointsTransitionDuration(0)
      .pathsData([])
      .pathPoints('points')
      .pathPointAlt(0.03)
      .pathColor('color')
      .pathStroke(null)
      .pathDashLength(1)
      .pathDashGap(0)
      .pathDashAnimateTime(0)
      .pathTransitionDuration(0);

    if (options.bumpTextureUrl) {
      this.globe.bumpImageUrl(options.bumpTextureUrl);
    }

    const controls = this.globe.controls();
    if (controls) {
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.75;
      controls.minDistance = 165;
      controls.maxDistance = 900;
      controls.autoRotate = Boolean(options.autoRotate) && !this.reducedMotion;
      controls.autoRotateSpeed = options.autoRotateSpeed ?? 0.32;
    }

    this.globe.pointOfView(options.initialView, 0);
    

    // With waitForGlobeReady disabled, onGlobeReady may fire during the
    // constructor, before the callback below is attached. Resolve readiness
    // after the first frame so the boot loader never waits on image downloads.
    requestAnimationFrame(() => this.handleReady());

    options.container.addEventListener('pointerenter', this.onPointerEnterStage, { passive: true });
    options.container.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    options.container.addEventListener('pointermove', this.onPointerMove, { passive: true });
    options.container.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    options.container.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    // Capture phase: decide whether a pointer event belongs to the globe or to
    // an overlay (header, card, toast) before globe.gl's own listeners see it.
    window.addEventListener('pointermove', this.onWindowPointerMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointerdown', this.onWindowPointerDown, {
      capture: true,
      passive: true,
    });

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.queueResize());
    this.resizeObserver?.observe(options.container);
  }

  setSelected(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.scheduleStyleRefresh();
  }

  /** Replace the trade-flow arc layer. */
  setArcs(arcs: TradeArc[]): void {
    this.globe.arcsData(arcs);
  }

  /** Update admin boundaries and sea routes in one paths-layer pass. */
  setGeoOverlays(
    adminPaths: Array<{ name: string; points: number[][] }>,
    seaRoutes: Array<{ points: number[][]; color?: string }>,
    color = '#e8f6f2',
  ): void {
    this.adminPaths = adminPaths.map((path) => ({
      points: path.points,
      color,
      width: 0.3,
    }));
    this.seaRoutes = seaRoutes.map((route) => ({
      points: route.points,
      color: color ?? route.color ?? '#ffb45e',
      width: 0.5,
    }));
    this.refreshPaths();
  }

  /** Replace the administrative-boundary lines for the hovered country. */
  setAdminPaths(paths: Array<{ name: string; points: number[][] }>, color = '#e8f6f2'): void {
    this.adminPaths = paths.map((path) => ({
      points: path.points,
      color,
      width: 0.3,
    }));
    this.refreshPaths();
  }

  /** Replace the navigable sea-route lines (port-to-port, searoute graph). */
  setSeaRoutes(routes: Array<{ points: number[][]; color?: string }>, color?: string): void {
    this.seaRoutes = routes.map((route) => ({
      points: route.points,
      color: color ?? route.color ?? '#ffb45e',
      width: 0.5,
    }));
    this.refreshPaths();
  }

  clearGeoOverlays(): void {
    this.adminPaths = [];
    this.seaRoutes = [];
    this.refreshPaths();
  }

  private refreshPaths(): void {
    this.globe.pathsData([...this.adminPaths, ...this.seaRoutes]);
  }

  /** Replace the airport/port markers for the hovered country. */
  setHubs(hubs: GlobeHub[], color = '#ffd99a'): void {
    this.globe.pointsData(
      hubs.map((hub) => ({
        ...hub,
        color,
        radius: hub.type === 'airport' ? 0.28 : hub.type === 'port' ? 0.24 : 0.2,
      })),
    );
  }

  /** Fly the camera to a country, with a zoom level based on its extent. */
  focusCountry(country: CountryShape): void {
    const [[west, south], [east, north]] = country.bounds;
    const span = Math.max(Math.abs(east - west), Math.abs(north - south));
    const altitude = Math.min(2.4, Math.max(0.8, 0.55 + span / 55));
    const lat = Math.min(Math.max(country.centroid.lat, -78), 78);

    this.globe.pointOfView(
      { lat, lng: country.centroid.lng, altitude },
      this.reducedMotion ? 0 : 900,
    );
    this.stopAutoRotate();
  }

  stopAutoRotate(): void {
    const controls = this.globe.controls();
    if (controls) controls.autoRotate = false;
  }

  clearHover(): void {
    this.setHovered(null);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.options.container.removeEventListener('pointerenter', this.onPointerEnterStage);
    this.options.container.removeEventListener('pointerdown', this.onPointerDown);
    this.options.container.removeEventListener('pointermove', this.onPointerMove);
    this.options.container.removeEventListener('pointerleave', this.onPointerLeave);
    this.options.container.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onWindowPointerMove, true);
    window.removeEventListener('pointerdown', this.onWindowPointerDown, true);
    this.resizeObserver?.disconnect();

    if (this.styleFrame != null) cancelAnimationFrame(this.styleFrame);
    if (this.resizeFrame != null) cancelAnimationFrame(this.resizeFrame);

    try {
      this.globe._destructor();
    } catch {
      // The renderer may already be gone during hot reload / page teardown.
    }
    this.options.container.replaceChildren();
  }

  get hoveredCountry(): CountryShape | null {
    return this.hovered;
  }

  get selectedCountryId(): string | null {
    return this.selectedId;
  }

  private handlePolygonHover(datum: object | null): void {
    // globe.gl raycasts pointer movement at window level, so it can report a
    // country underneath the header or the floating card. Check the actual
    // element under the pointer instead of relying on a flag that can go stale
    // after the page loads or after an overlay closes.
    if (!this.pointerIsOverStage()) {
      this.setHovered(null);
      return;
    }
    if (this.dragged) return;
    const country = datum ? this.lookupShape(datum) : null;
    this.setHovered(country);
    if (country) this.stopAutoRotate();
  }

  private handlePolygonClick(datum: object, event: MouseEvent): void {
    if (!this.pointerIsOverStage() || this.dragged || event.defaultPrevented) return;
    const country = this.lookupShape(datum);
    if (!country) return;
    event.stopPropagation();
    this.options.onCountryClick?.({ country, point: this.pointer });
  }

  private handleGlobeClick(): void {
    if (!this.pointerIsOverStage() || this.dragged) return;
    this.options.onBackgroundClick?.();
  }

  private handleReady(): void {
    if (this.ready) return;
    this.ready = true;
    // A tab that was backgrounded while textures loaded can miss the first
    // animation frame and show an empty canvas until the next resize.
    // Re-applying the current size forces an initial render.
    this.queueResize();
    this.options.onReady?.();
  }

  private pointerIsOverStage(): boolean {
    const element = document.elementFromPoint(this.pointer.x, this.pointer.y);
    return element != null && this.options.container.contains(element);
  }

  private setHovered(country: CountryShape | null): void {
    if ((this.hovered?.id ?? null) === (country?.id ?? null)) return;
    this.hovered = country;
    this.scheduleStyleRefresh();
    this.options.onHover?.({ country, point: this.pointer });
  }

  private scheduleStyleRefresh(): void {
    if (this.styleFrame != null || this.destroyed) return;
    this.styleFrame = requestAnimationFrame(() => {
      this.styleFrame = null;
      if (this.destroyed) return;
      this.globe
        .polygonAltitude((datum) => this.altitudeFor(datum))
        .polygonCapColor((datum) => this.capColorFor(datum))
        .polygonStrokeColor((datum) => this.strokeColorFor(datum));
    });
  }

  private altitudeFor(datum: object): number {
    const country = this.lookupShape(datum);
    if (!country) return 0.008;
    if (country.id === '156') return this.hovered?.id === country.id ? 0.026 : 0.012;
    if (this.hovered?.id === country.id) return 0.022;
    if (this.selectedId === country.id) return 0.014;
    return this.focusIds.has(country.id) ? 0.01 : 0.007;
  }

  private capColorFor(datum: object): string {
    const country = this.lookupShape(datum);
    if (!country) return MARKET_CAP;
    if (country.id === '156') return this.hovered?.id === country.id ? CHINA_HOVER_CAP : CHINA_CAP;
    const hovered = this.hovered?.id === country.id;
    const selected = this.selectedId === country.id;
    const focus = this.focusIds.has(country.id);
    if (hovered && selected) return focus ? SELECTED_HOVER_CAP : MARKET_HOVER_CAP;
    if (hovered) return focus ? HOVER_CAP : MARKET_HOVER_CAP;
    if (selected) return focus ? SELECTED_CAP : MARKET_SELECTED_CAP;
    return focus ? FOCUS_CAP : MARKET_CAP;
  }

  private strokeColorFor(datum: object): string {
    const country = this.lookupShape(datum);
    if (!country) return MARKET_STROKE;
    if (country.id === '156') return CHINA_STROKE;
    if (this.hovered?.id === country.id || this.selectedId === country.id) {
      return this.focusIds.has(country.id) ? FOCUS_ACTIVE_STROKE : MARKET_ACTIVE_STROKE;
    }
    return this.focusIds.has(country.id) ? FOCUS_STROKE : MARKET_STROKE;
  }

  private lookupShape(datum: object): CountryShape | null {
    const direct = this.shapeByFeature.get(datum);
    if (direct) return direct;

    const feature = datum as CountryFeature;
    const id = typeof feature.id === 'string' || typeof feature.id === 'number'
      ? String(feature.id).padStart(3, '0')
      : null;
    if (id) {
      const byId = this.shapeById.get(id);
      if (byId) return byId;
    }

    const name = typeof feature.properties?.name === 'string'
      ? feature.properties.name
      : null;
    return name ? this.shapeByFeatureName.get(name) ?? null : null;
  }

  private queueResize(): void {
    if (this.resizeFrame != null || this.destroyed) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      if (this.destroyed) return;
      const width = this.options.container.clientWidth;
      const height = this.options.container.clientHeight;
      if (width > 0 && height > 0) {
        this.globe.width(width).height(height);
      }
    });
  }

  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    const target = event.target;
    const overStage =
      target instanceof Node && this.options.container.contains(target);
    if (!overStage) {
      if (this.pointerOnStage) {
        this.pointerOnStage = false;
        this.setHovered(null);
      }
      return;
    }
    this.pointerOnStage = true;
  };

  private readonly onWindowPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    this.pointerOnStage =
      target instanceof Node && this.options.container.contains(target);
  };

  private readonly onPointerEnterStage = (): void => {
    this.pointerOnStage = true;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerOnStage = true;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.pointerDownAt = { x: event.clientX, y: event.clientY };
    this.dragged = false;
    if (event.button === 0 || event.pointerType === 'touch') {
      this.stopAutoRotate();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerOnStage = true;
    this.pointer = { x: event.clientX, y: event.clientY };

    if (event.buttons === 0) {
      this.pointerDownAt = null;
    } else if (this.pointerDownAt && !this.dragged) {
      const dx = event.clientX - this.pointerDownAt.x;
      const dy = event.clientY - this.pointerDownAt.y;
      if (Math.hypot(dx, dy) > 7) {
        this.dragged = true;
        this.setHovered(null);
      }
    }

    if (!this.dragged) {
      this.options.onPointerMove?.({ x: event.clientX, y: event.clientY });
    }
  };

  private readonly onPointerUp = (): void => {
    this.pointerDownAt = null;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerOnStage = false;
    this.pointerDownAt = null;
    this.dragged = false;
    this.setHovered(null);
  };

  private readonly onWheel = (): void => {
    this.stopAutoRotate();
  };
}
