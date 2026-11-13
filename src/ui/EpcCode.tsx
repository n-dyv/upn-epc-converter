import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { epcQrMatrix, matrixToRgba, QUIET_ZONE, type QrMatrix } from "./qr";

const MIN_CSS_PX = 280;

/** Draw the matrix (black on white, 4-module quiet zone) onto a canvas, `scale` device pixels per module. */
export function drawMatrix(canvas: HTMLCanvasElement, m: QrMatrix, scale: number) {
  const px = matrixToRgba(m, scale);
  canvas.width = px.width;
  canvas.height = px.height;
  canvas.getContext("2d")!.putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
}

/** Content width available to the code: the .card-code panel minus its padding and the frame's padding. */
function availableWidth(canvas: HTMLCanvasElement): number | null {
  const frame = canvas.parentElement;
  const panel = frame?.parentElement;
  if (!frame || !panel) return null;
  const pad = (el: Element) => {
    const s = getComputedStyle(el);
    return parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
  };
  return panel.clientWidth - pad(panel) - pad(frame);
}

/**
 * The QR is drawn with a whole number of device pixels per module, so it stays crisp at any size.
 * Preferred size: ≥ 280 CSS px. On narrow screens it takes the largest crisp size that fits.
 */
export function EpcCode({ payload, label }: { payload: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const matrix = useMemo(() => epcQrMatrix(payload), [payload]);
  const modules = matrix.size + 2 * QUIET_ZONE;
  const preferredCss = modules * Math.max(4, Math.ceil(MIN_CSS_PX / modules));
  const [avail, setAvail] = useState<number | null>(null);

  // Track the space available (window resize, layout changes).
  useLayoutEffect(() => {
    const canvas = ref.current;
    const panel = canvas?.parentElement?.parentElement;
    if (!canvas || !panel) return;
    const update = () => setAvail(availableWidth(canvas));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  const dpr = window.devicePixelRatio || 1;
  const targetCss = avail === null ? preferredCss : Math.min(preferredCss, avail);
  const devicePxPerModule = Math.max(1, Math.floor((targetCss * dpr) / modules));
  const cssSize = (devicePxPerModule * modules) / dpr;

  useEffect(() => {
    if (ref.current) drawMatrix(ref.current, matrix, devicePxPerModule);
  }, [matrix, devicePxPerModule]);

  return (
    <canvas
      ref={ref}
      className="epc-code"
      style={{ width: cssSize, height: cssSize }}
      role="img"
      aria-label={label}
      data-testid="epc-code"
      data-payload={payload}
    />
  );
}
