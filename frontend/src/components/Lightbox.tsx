import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { assetUrl } from '../api/client';
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from './Icons';

interface LightboxProps {
  images: Array<{ id: number; path: string }>;
  index: number;
  title: string;
  onClose: () => void;
  onChange: (index: number) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_DISTANCE = 50;
const DOUBLE_TAP_MS = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Gesture {
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  pinchDistance: number;
  pinchScale: number;
  moved: boolean;
  pinched: boolean;
  startedAt: number;
}

export function Lightbox({ images, index, title, onClose, onChange }: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomTimer = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    pinchDistance: 0,
    pinchScale: 1,
    moved: false,
    pinched: false,
    startedAt: 0,
  });
  const lastTap = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  }, []);

  const revealZoom = useCallback(() => {
    setZoomVisible(true);
    if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
    zoomTimer.current = window.setTimeout(() => setZoomVisible(false), 2200);
  }, []);

  useEffect(
    () => () => {
      if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
    },
    [],
  );

  const clampOffset = useCallback((x: number, y: number, nextScale: number) => {
    const stage = stageRef.current;
    const width = stage?.clientWidth ?? 0;
    const height = stage?.clientHeight ?? 0;
    const maxX = Math.max(0, (width * (nextScale - 1)) / 2);
    const maxY = Math.max(0, (height * (nextScale - 1)) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  const changeScale = useCallback(
    (next: number) => {
      revealZoom();
      const nextScale = clamp(next, MIN_SCALE, MAX_SCALE);
      setScale(nextScale);
      setOffset((current) =>
        nextScale === MIN_SCALE ? { x: 0, y: 0 } : clampOffset(current.x, current.y, nextScale),
      );
    },
    [clampOffset, revealZoom],
  );

  const goNext = useCallback(() => {
    reset();
    onChange((index + 1) % images.length);
  }, [index, images.length, onChange, reset]);

  const goPrev = useCallback(() => {
    reset();
    onChange((index - 1 + images.length) % images.length);
  }, [index, images.length, onChange, reset]);

  useEffect(() => {
    reset();
  }, [index, reset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') goNext();
      else if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === '+' || event.key === '=') changeScale(scale + 0.5);
      else if (event.key === '-') changeScale(scale - 0.5);
      else if (event.key === '0') reset();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [changeScale, goNext, goPrev, onClose, reset, scale]);

  const pointerPositions = () => Array.from(pointers.current.values());

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    revealZoom();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort (older browsers).
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      gesture.current = {
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
        pinchDistance: 0,
        pinchScale: scale,
        moved: false,
        pinched: false,
        startedAt: Date.now(),
      };
      setDragging(scale > MIN_SCALE);
    } else if (pointers.current.size === 2) {
      const [first, second] = pointerPositions();
      gesture.current.pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      gesture.current.pinchScale = scale;
      gesture.current.moved = true;
      gesture.current.pinched = true;
      setDragging(true);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;

    if (pointers.current.size >= 2) {
      const [first, second] = pointerPositions();
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (current.pinchDistance > 0) {
        const nextScale = clamp((current.pinchScale * distance) / current.pinchDistance, MIN_SCALE, MAX_SCALE);
        setScale(nextScale);
        setOffset((latest) =>
          nextScale === MIN_SCALE ? { x: 0, y: 0 } : clampOffset(latest.x, latest.y, nextScale),
        );
      }
      return;
    }

    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) current.moved = true;

    if (scale > MIN_SCALE) {
      setOffset(clampOffset(current.startOffsetX + dx, current.startOffsetY + dy, scale));
    }
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;

    // A finger lifted mid-pinch: keep panning with the remaining one without a jump.
    if (pointers.current.size === 1) {
      const [remaining] = pointerPositions();
      current.startX = remaining.x;
      current.startY = remaining.y;
      current.startOffsetX = offset.x;
      current.startOffsetY = offset.y;
      current.moved = true;
      return;
    }
    if (pointers.current.size > 0) return;

    setDragging(false);
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    const wasTap = !current.moved && Date.now() - current.startedAt < 350;

    if (wasTap) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        if (scale > MIN_SCALE) reset();
        else changeScale(2.5);
      } else {
        lastTap.current = now;
      }
      return;
    }

    if (
      !current.pinched &&
      scale <= MIN_SCALE + 0.02 &&
      Math.abs(dx) > SWIPE_DISTANCE &&
      Math.abs(dx) > Math.abs(dy) * 1.2
    ) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    changeScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  const image = images[index];
  if (!image) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${title} — page ${index + 1}`}>
      <div className="lightbox__bar">
        <span>
          Page {index + 1} of {images.length}
        </span>
        <div className="lightbox__tools">
          {zoomVisible || scale > MIN_SCALE ? (
            <div className="lightbox__zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => changeScale(scale - 0.5)} disabled={scale <= MIN_SCALE} aria-label="Zoom out">
                −
              </button>
              <button type="button" onClick={reset} aria-label="Reset zoom">
                {Math.round(scale * 100)}%
              </button>
              <button type="button" onClick={() => changeScale(scale + 0.5)} disabled={scale >= MAX_SCALE} aria-label="Zoom in">
                +
              </button>
            </div>
          ) : null}
          <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close preview">
            <CloseIcon size={22} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`lightbox__stage ${dragging ? 'is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
      >
        <img
          className="lightbox__image"
          src={assetUrl(image.path)}
          alt={`${title} — page ${index + 1}`}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.18s ease',
            cursor: scale > MIN_SCALE ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      <button
        type="button"
        className="lightbox__nav lightbox__nav--prev"
        onClick={goPrev}
        aria-label="Previous page"
      >
        <ArrowLeftIcon size={24} />
      </button>
      <button
        type="button"
        className="lightbox__nav lightbox__nav--next"
        onClick={goNext}
        aria-label="Next page"
      >
        <ArrowRightIcon size={24} />
      </button>

      <p className="lightbox__hint">Pinch or scroll to zoom · drag to pan · swipe for pages</p>
    </div>
  );
}
