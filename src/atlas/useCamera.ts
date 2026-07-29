// The camera (AD-3): d3-zoom's internal transform is the single source of
// truth. Its handler writes the transform to the inner <g> imperatively —
// zero React renders during a gesture. React state holds only the discrete
// semantic tier: zooming descends the ladder of scales — the town plan,
// then the buildings inside a district, then the construction details on a
// building. Nothing else ever writes the transform; future programmatic
// moves (Phase 3 centering) go through zoom.transform.

import { useEffect, useState, type RefObject } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom'

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

export function useCamera(
  svgRef: RefObject<SVGSVGElement | null>,
  cameraRef: RefObject<SVGGElement | null>,
  world: World,
  onTransform?: (t: ZoomTransform) => void,
): LodTier {
  const [tier, setTier] = useState<LodTier>('town')

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

    const selection = select(svg)
    selection.call(behavior)
    selection.call(behavior.transform, fit)

    // Safari pinch fires proprietary gesture events that would zoom the page.
    const suppress = (e: Event) => e.preventDefault()
    svg.addEventListener('gesturestart', suppress)

    return () => {
      selection.on('.zoom', null)
      svg.removeEventListener('gesturestart', suppress)
    }
  }, [svgRef, cameraRef, world, onTransform])

  return tier
}
