export type SignalMarker = {
  id: string;
  offsetHz: number;
  bandwidthHz: number;
  label: string;
  color: string;
};

type DrawOptions = {
  markers: SignalMarker[];
  width: number;
  height: number;
  /** Maps an LO-relative offset (Hz) to a CSS pixel x. */
  offsetToX: (offsetHz: number) => number;
  /** Maps a bandwidth (Hz) to a CSS pixel width. */
  hzToPx: (hz: number) => number;
};

const ROW_HEIGHT = 13;
const ROW_COUNT = 3;
const TOP_MARGIN = 4;

/**
 * Annotates identified signals over the spectrum trace.
 *
 * Kept deliberately quiet — a thin bracket over the occupied bandwidth and a
 * small label — so the trace underneath stays the thing you read first.
 * Labels are packed onto a few rows and dropped when they would collide.
 */
export function drawSignalMarkers(
  ctx: CanvasRenderingContext2D,
  { markers, width, height, offsetToX, hzToPx }: DrawOptions,
): void {
  if (markers.length === 0) return;

  ctx.save();
  ctx.font = "10px var(--font-mono), ui-monospace, monospace";
  ctx.textBaseline = "top";

  const positioned = markers
    .map((marker) => {
      const centerX = offsetToX(marker.offsetHz);
      const halfSpan = Math.max(hzToPx(marker.bandwidthHz), 3) / 2;
      return { marker, centerX, left: centerX - halfSpan, right: centerX + halfSpan };
    })
    .filter(({ left, right }) => right >= 0 && left <= width)
    .sort((a, b) => a.centerX - b.centerX);

  // Right-most x already consumed on each label row.
  const rowEnds = new Array<number>(ROW_COUNT).fill(-Infinity);

  for (const { marker, centerX, left, right } of positioned) {
    const bandTop = TOP_MARGIN + ROW_COUNT * ROW_HEIGHT;

    ctx.fillStyle = `color-mix(in oklch, ${marker.color} 10%, transparent)`;
    ctx.fillRect(left, bandTop, right - left, height - bandTop);

    const textWidth = ctx.measureText(marker.label).width;
    const labelLeft = Math.min(
      Math.max(centerX - textWidth / 2, 2),
      width - textWidth - 2,
    );

    let row = -1;
    for (let r = 0; r < ROW_COUNT; r++) {
      if (labelLeft > rowEnds[r] + 6) {
        row = r;
        break;
      }
    }

    const bracketY = row >= 0 ? TOP_MARGIN + (row + 1) * ROW_HEIGHT - 3 : bandTop - 3;

    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(left, bracketY);
    ctx.lineTo(right, bracketY);
    ctx.moveTo(left, bracketY);
    ctx.lineTo(left, bracketY + 4);
    ctx.moveTo(right, bracketY);
    ctx.lineTo(right, bracketY + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (row < 0) continue;
    rowEnds[row] = labelLeft + textWidth;
    ctx.fillStyle = marker.color;
    ctx.fillText(marker.label, labelLeft, TOP_MARGIN + row * ROW_HEIGHT);
  }

  ctx.restore();
}
