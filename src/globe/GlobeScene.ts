import Globe from 'globe.gl';
import type { GlobeInstance } from 'globe.gl';
import type { CountryFeature, CountryShape, GlobeCountryEvent, GlobeHoverEvent } from './types';
import type { InitialView } from '../config';
import type { ScreenPoint } from '../shared/coords';

export interface GlobeSceneOptions {
  container: HTMLElement;
  countries: CountryShape[];
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

const BASE_CAP = 'rgba(38, 143, 128, 0.22)';
const DIMMED_CAP = 'rgba(38, 143, 128, 0.10)';
const HOVER_CAP = 'rgba(246, 193, 104, 0.62)';
const SELECTED_CAP = 'rgba(235, 169, 81, 0.48)';
const SELECTED_HOVER_CAP = 'rgba(255, 216, 146, 0.78)';

const BASE_STROKE = 'rgba(133, 224, 205, 0.38)';
const ACTIVE_STROKE = 'rgba(255, 224, 166, 0.95)';
const SIDE_COLOR = 'rgba(3, 17, 22, 0.72)';

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
    this.reducedMotion =
      options.reducedMotion ??
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;

    for (const country of options.countries) {
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
      .polygonsData(options.countries.map((country) => country.feature))
      .polygonsTransitionDuration(180)
      .polygonLabel(() => '')
      .polygonAltitude((datum) => this.altitudeFor(datum))
      .polygonCapColor((datum) => this.capColorFor(datum))
      .polygonSideColor(() => SIDE_COLOR)
      .polygonStrokeColor((datum) => this.strokeColorFor(datum))
      .onPolygonHover((datum) => this.handlePolygonHover(datum))
      .onPolygonClick((datum, event) => this.handlePolygonClick(datum, event))
      .onGlobeClick(() => this.handleGlobeClick())
      .onGlobeReady(() => this.handleReady());

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
    // country underneath the header or the floating card. Ignore those.
    if (!this.pointerOnStage) {
      this.setHovered(null);
      return;
    }
    if (this.dragged) return;
    const country = datum ? this.lookupShape(datum) : null;
    this.setHovered(country);
    if (country) this.stopAutoRotate();
  }

  private handlePolygonClick(datum: object, event: MouseEvent): void {
    if (!this.pointerOnStage || this.dragged || event.defaultPrevented) return;
    const country = this.lookupShape(datum);
    if (!country) return;
    event.stopPropagation();
    this.options.onCountryClick?.({ country, point: this.pointer });
  }

  private handleGlobeClick(): void {
    if (!this.pointerOnStage || this.dragged) return;
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
    if (this.hovered?.id === country.id) return 0.024;
    if (this.selectedId === country.id) return 0.016;
    return 0.008;
  }

  private capColorFor(datum: object): string {
    const country = this.lookupShape(datum);
    if (!country) return BASE_CAP;
    const hovered = this.hovered?.id === country.id;
    const selected = this.selectedId === country.id;
    if (hovered && selected) return SELECTED_HOVER_CAP;
    if (hovered) return HOVER_CAP;
    if (selected) return SELECTED_CAP;
    return this.selectedId ? DIMMED_CAP : BASE_CAP;
  }

  private strokeColorFor(datum: object): string {
    const country = this.lookupShape(datum);
    if (!country) return BASE_STROKE;
    if (this.hovered?.id === country.id || this.selectedId === country.id) {
      return ACTIVE_STROKE;
    }
    return BASE_STROKE;
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
