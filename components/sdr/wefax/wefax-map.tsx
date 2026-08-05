"use client";

import {
  REACH_TIER_LABEL,
  type ReachabilityTier,
  type StationReachability,
} from "@/lib/sdr/wefax/reachability";
import type { WefaxStation } from "@/lib/sdr/wefax/stations";

/** Equirectangular crop covering USCG radiofax footprint. */
const MAP_LON0 = -180;
const MAP_LON1 = -40;
const MAP_LAT0 = 10;
const MAP_LAT1 = 72;
const W = 320;
const H = 168;

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - MAP_LON0) / (MAP_LON1 - MAP_LON0)) * W;
  const y = ((MAP_LAT1 - lat) / (MAP_LAT1 - MAP_LAT0)) * H;
  return { x, y };
}

function tierClass(tier: ReachabilityTier): string {
  return `wefax-reach wefax-reach-${tier}`;
}

type Props = {
  stations: readonly WefaxStation[];
  scores: readonly StationReachability[];
  selectedId: string;
  listener: { lat: number; lon: number; precise: boolean };
  onSelect: (id: string) => void;
  onLocate: () => void;
  locating: boolean;
};

export function WefaxMap({
  stations,
  scores,
  selectedId,
  listener,
  onSelect,
  onLocate,
  locating,
}: Props) {
  const byId = new Map(scores.map((s) => [s.station.id, s]));
  const listenerPt = project(listener.lat, listener.lon);
  const listenerInView =
    listener.lon >= MAP_LON0 &&
    listener.lon <= MAP_LON1 &&
    listener.lat >= MAP_LAT0 &&
    listener.lat <= MAP_LAT1;

  return (
    <div className="wefax-map">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-medium text-muted">Stations</p>
        <button
          type="button"
          className="text-[0.65rem] text-accent underline-offset-2 hover:underline disabled:opacity-50"
          onClick={onLocate}
          disabled={locating}
          title="Use device location for HF reachability"
        >
          {locating
            ? "Locating…"
            : listener.precise
              ? "Update location"
              : "Use my location"}
        </button>
      </div>

      <svg
        className="wefax-map-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Weatherfax transmitter map"
      >
        <rect width={W} height={H} className="wefax-map-ocean" />
        <path
          className="wefax-map-land"
          d="M78 28 L95 22 L118 28 L130 42 L125 58 L108 72 L92 78 L70 70 L62 52 Z
             M118 78 L145 70 L168 78 L175 98 L160 118 L130 122 L112 108 L108 90 Z
             M168 40 L195 32 L220 40 L235 58 L228 78 L200 88 L175 72 L168 55 Z
             M48 8 L72 4 L95 12 L88 28 L60 32 L45 20 Z
             M210 95 L248 88 L275 102 L268 128 L240 138 L215 125 L208 108 Z
             M255 45 L290 38 L310 55 L300 78 L270 85 L252 68 Z"
        />
        {[30, 40, 50, 60].map((lat) => {
          const { y } = project(lat, MAP_LON0);
          return (
            <line
              key={`lat-${lat}`}
              x1={0}
              x2={W}
              y1={y}
              y2={y}
              className="wefax-map-grid"
            />
          );
        })}
        {[-150, -120, -90, -60].map((lon) => {
          const { x } = project(MAP_LAT0, lon);
          return (
            <line
              key={`lon-${lon}`}
              y1={0}
              y2={H}
              x1={x}
              x2={x}
              className="wefax-map-grid"
            />
          );
        })}

        {stations.map((station) => {
          const { x, y } = project(station.lat, station.lon);
          const score = byId.get(station.id);
          const tier = score?.best?.tier ?? (score?.onAir ? "fair" : "off");
          const selected = station.id === selectedId;
          return (
            <g
              key={station.id}
              className="wefax-map-station"
              role="button"
              tabIndex={0}
              aria-label={`${station.callsign} ${station.name}, reachability ${REACH_TIER_LABEL[tier]}`}
              aria-pressed={selected}
              onClick={() => onSelect(station.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(station.id);
                }
              }}
            >
              {score?.onAir ? (
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? 14 : 11}
                  className="wefax-map-pulse"
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r={selected ? 6.5 : 5}
                className={`wefax-map-dot ${tierClass(tier)} ${selected ? "wefax-map-dot-selected" : ""}`}
              />
              {/* Larger invisible hit target */}
              <circle cx={x} cy={y} r={14} fill="transparent" />
              <text
                x={x + 8}
                y={y + 3}
                className={`wefax-map-label ${selected ? "wefax-map-label-selected" : ""}`}
              >
                {station.callsign}
              </text>
            </g>
          );
        })}

        {listenerInView ? (
          <g>
            <circle
              cx={listenerPt.x}
              cy={listenerPt.y}
              r={3.5}
              className="wefax-map-you"
            />
            <text
              x={listenerPt.x + 7}
              y={listenerPt.y + 3}
              className="wefax-map-label wefax-map-you-label"
            >
              You
            </text>
          </g>
        ) : null}
      </svg>

      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6rem] text-muted">
        {(["good", "fair", "poor", "off"] as const).map((tier) => (
          <li key={tier} className="flex items-center gap-1">
            <span className={`wefax-reach-swatch ${tierClass(tier)}`} />
            {REACH_TIER_LABEL[tier]}
          </li>
        ))}
      </ul>
      {!listener.precise ? (
        <p className="mt-1 text-[0.6rem] leading-relaxed text-muted">
          Reachability uses a US centroid until location is allowed.
        </p>
      ) : null}
    </div>
  );
}
