// The camera (AD-3): d3-zoom's internal transform is the single source of
// truth. Its handler writes the transform to the inner <g> imperatively —
// zero React renders during a gesture. React state holds only the discrete
// semantic tier: zooming descends the ladder of scales — the town plan,
// then the buildings inside a district, then the construction details on a
// building. Nothing else ever writes the transform; future programmatic
// moves (Phase 3 centering) go through zoom.transform.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { select } from 'd3-selection'
import 'd3-transition' // side effect: selection.transition()
import {
  zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3-zoom'

/** k thresholds where the map changes meaning. */
export const BUILDING_K = 1.5
export const CONSTRUCTION_K = 3.2
export const MAX_K = 9

export type LodTier = 'town' | 'building' | 'construction'

export interface World {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function tierFor(k: number): LodTier {
  if (k < BUILDING_K) return 'town'
  if (k < CONSTRUCTION_K) return 'building'
  return 'construction'
}

/** The transform that fits the world into a w×h viewport, 5% breathing room. */
export function fitTransform(world: World, w: number, h: number): ZoomTransform {
  const k = Math.min(w / (world.x1 - world.x0), h / (world.y1 - world.y0)) * 0.95
  const tx = (w - (world.x1 - world.x0) * k) / 2 - world.x0 * k
  const ty = (h - (world.y1 - world.y0) * k) / 2 - world.y0 * k
  return zoomIdentity.translate(tx, ty).scale(k)
}

/** Mid-band zoom the tier rail dives to for each scale. */
export const TIER_RAIL_K: Record<Exclude<LodTier, 'town'>, number> = {
  building: 2.2,
  construction: 4.2,
}

export interface Camera {
  tier: LodTier
  /**
   * Animate the camera toward a world point: a named, interruptible
   * transition (latest-wins; any user gesture interrupts it). Zooms IN to
   * at least minK, never out. shiftX moves the focal point left of the
   * viewport center (room for the card). Instant under reduced motion.
   */
  centerOn: (wx: number, wy: number, minK: number, shiftX?: number) => void
  /**
   * Jump the camera to a semantic tier: 'town' refits the whole village;
   * the deeper tiers zoom about the current viewport center.
   */
  zoomTier: (tier: LodTier) => void
}

export function useCamera(
  svgRef: RefObject<SVGSVGElement | null>,
  cameraRef: RefObject<SVGGElement | null>,
  world: World,
  onTransform?: (t: ZoomTransform) => void,
): Camera {
  const [tier, setTier] = useState<LodTier>('town')
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const fitRef = useRef<ZoomTransform | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    const camera = cameraRef.current
    if (!svg || !camera) return

    const w = svg.clientWidth || 960
    const h = svg.clientHeight || 720
    const fit = fitTransform(world, w, h)
    const pad = 80

    const behavior = zoom<SVGSVGElement, unknown>()
      // Explicit extent: d3-zoom's default reads svg.viewBox, which jsdom
      // lacks, and we already know the viewport.
      .extent([
        [0, 0],
        [w, h],
      ])
      .scaleExtent([fit.k, MAX_K])
      .translateExtent([
        [world.x0 - pad, world.y0 - pad],
        [world.x1 + pad, world.y1 + pad],
      ])
      .clickDistance(6)
      .on('zoom', (event: { transform: ZoomTransform }) => {
        const t = event.transform
        camera.setAttribute('transform', t.toString())
        onTransform?.(t)
        setTier(tierFor(t.k)) // same-value updates bail out render-free
      })
      // A user gesture always wins immediately over an in-flight centering.
      .on('start.interrupt', (event: { sourceEvent: Event | null }) => {
        if (event.sourceEvent) select(svg).interrupt('atlas-center')
      })

    const selection = select(svg)
    selection.call(behavior)
    selection.call(behavior.transform, fit)
    behaviorRef.current = behavior
    fitRef.current = fit

    // Safari pinch fires proprietary gesture events that would zoom the page.
    const suppress = (e: Event) => e.preventDefault()
    svg.addEventListener('gesturestart', suppress)

    return () => {
      selection.on('.zoom', null)
      behaviorRef.current = null
      svg.removeEventListener('gesturestart', suppress)
    }
  }, [svgRef, cameraRef, world, onTransform])

  const glide = useCallback(
    (target: ZoomTransform) => {
      const svg = svgRef.current
      const behavior = behaviorRef.current
      if (!svg || !behavior) return
      const reduce =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const selection = select(svg)
      if (reduce) {
        selection.call(behavior.transform, target)
      } else {
        selection
          .transition('atlas-center')
          .duration(650)
          .call(behavior.transform, target)
      }
    },
    [svgRef],
  )

  const centerOn = useCallback(
    (wx: number, wy: number, minK: number, shiftX = 0) => {
      const svg = svgRef.current
      if (!svg) return
      const w = svg.clientWidth || 960
      const h = svg.clientHeight || 720
      const k = Math.min(Math.max(zoomTransform(svg).k, minK), MAX_K)
      glide(
        zoomIdentity
          .translate(w / 2 - shiftX, h / 2)
          .scale(k)
          .translate(-wx, -wy),
      )
    },
    [svgRef, glide],
  )

  const zoomTier = useCallback(
    (target: LodTier) => {
      const svg = svgRef.current
      if (!svg) return
      if (target === 'town') {
        if (fitRef.current) glide(fitRef.current)
        return
      }
      const w = svg.clientWidth || 960
      const h = svg.clientHeight || 720
      const cur = zoomTransform(svg)
      const [wcx, wcy] = cur.invert([w / 2, h / 2])
      glide(
        zoomIdentity
          .translate(w / 2, h / 2)
          .scale(TIER_RAIL_K[target])
          .translate(-wcx, -wcy),
      )
    },
    [svgRef, glide],
  )

  return { tier, centerOn, zoomTier }
}
