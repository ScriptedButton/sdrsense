"use client";

import {
  formatCountdown,
  formatUtcHmm,
  nextProductForStation,
  nextWefaxWorldwide,
  upcomingProducts,
  type WefaxLiveProduct,
} from "@/lib/sdr/wefax/schedule";
import type { WefaxStation } from "@/lib/sdr/wefax/stations";

type Props = {
  station: WefaxStation;
  nowMin: number;
  onTuneNext: (live: WefaxLiveProduct) => void;
};

export function WefaxSchedule({ station, nowMin, onTuneNext }: Props) {
  const world = nextWefaxWorldwide(nowMin);
  const local = nextProductForStation(station, nowMin);
  const upcoming = upcomingProducts(station, 150, nowMin).slice(0, 8);

  return (
    <div className="wefax-schedule">
      <p className="mb-1.5 text-[0.65rem] font-medium text-muted">Schedule</p>

      {world ? (
        <div className="wefax-next-banner">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted">
              {world.transmitting ? "On air" : "Next fax"}
            </p>
            <p className="truncate font-mono text-sm text-ink">
              {world.station.callsign} · {formatUtcHmm(world.product.startMin)}
            </p>
            <p className="truncate text-[0.7rem] text-muted">
              {world.product.title}
              {world.station.id !== station.id
                ? ` · ${world.station.name}`
                : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-sm text-accent">
              {world.transmitting
                ? "LIVE"
                : formatCountdown(world.minutesUntil)}
            </span>
            <button
              type="button"
              className="btn-secondary !min-h-7 !px-2 !text-[0.65rem]"
              onClick={() => onTuneNext(world)}
            >
              Tune
            </button>
          </div>
        </div>
      ) : null}

      {local &&
      (world?.station.id !== local.station.id ||
        world.product.startMin !== local.product.startMin) ? (
        <p className="mt-1.5 text-[0.65rem] text-muted">
          Next here · {formatUtcHmm(local.product.startMin)} ·{" "}
          {local.transmitting ? "LIVE" : formatCountdown(local.minutesUntil)} ·{" "}
          {local.product.title}
        </p>
      ) : null}

      <ul className="wefax-schedule-list">
        {upcoming.map((item) => (
          <li key={`${item.product.startMin}-${item.product.title}`}>
            <button
              type="button"
              className={`wefax-schedule-row ${item.transmitting ? "wefax-schedule-row-live" : ""}`}
              onClick={() => onTuneNext(item)}
              title="Tune USB and decode"
            >
              <span className="font-mono text-[0.7rem] text-accent">
                {formatUtcHmm(item.product.startMin)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.7rem] text-ink">
                {item.product.title}
              </span>
              <span className="shrink-0 font-mono text-[0.65rem] text-muted">
                {item.transmitting
                  ? "LIVE"
                  : formatCountdown(item.minutesUntil)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {upcoming.length === 0 ? (
        <p className="text-[0.65rem] text-muted">No charts in the next 2.5 h.</p>
      ) : null}
    </div>
  );
}
