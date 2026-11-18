import { cn } from "@/lib/utils";

/**
 * A 32px daily trend under a KPI. Plain SVG rather than a chart library: it
 * has no axes or tooltip, and drawing it on the server means it is there
 * before any JavaScript loads.
 *
 * The line draws in once (CSS `md-draw` over a normalised `pathLength`). The
 * area under it is 8% of the meaning colour and deepens to 14% when the tile
 * it sits in is hovered (`group/tile`). The last point gets a dot, drawn in
 * HTML so the stretched SVG viewBox does not squash it into an oval.
 */
export function Sparkline({
  values,
  color,
  className,
}: {
  values: number[];
  /** A CSS colour, normally `var(--meaning)`. */
  color: string;
  className?: string;
}) {
  const W = 100;
  const H = 32;
  const PAD = 3;
  const max = Math.max(...values, 0);
  const n = values.length;

  if (n < 2) return <div className={cn("h-8", className)} />;

  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => (max === 0 ? H - PAD : H - PAD - (v / max) * (H - PAD * 2));
  const points = values.map((v, i) => [x(i), y(v)] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const [lastX, lastY] = points[n - 1];

  return (
    <div className={cn("relative h-8", className)} style={{ color }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible">
        <path
          d={area}
          fill="currentColor"
          className="opacity-[0.08] transition-opacity duration-(--dur-quick) group-hover/tile:opacity-[0.14]"
        />
        <path
          d={line}
          pathLength={1}
          fill="none"
          stroke={max === 0 ? "var(--line-strong)" : "currentColor"}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="md-draw"
          style={{ animationDelay: "100ms" }}
        />
      </svg>
      {max > 0 && (
        <span
          className="md-fade absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-(--surface)"
          style={{
            left: `${(lastX / W) * 100}%`,
            top: `${(lastY / H) * 100}%`,
            backgroundColor: "currentColor",
            animationDelay: "650ms",
          }}
        />
      )}
    </div>
  );
}
