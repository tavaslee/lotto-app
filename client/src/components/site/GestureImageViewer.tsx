import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMobileOrTablet } from "@/hooks/useMobileOrTablet";
import React, { type PointerEvent, type WheelEvent as ReactWheelEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Point = { x: number; y: number };
type Transform = { scale: number; position: Point };
type ViewMode = "native" | "full" | "fitWidth";
type SwipeStart = Point & { pointerId: number };
type Gesture =
  | { kind: "drag"; start: Point; origin: Point }
  | { kind: "pinch"; distance: number; scale: number; position: Point; center: Point };

const IMAGE_VIEWER_HISTORY_MARKER = "__caishenImageViewer";
const IMAGE_VIEWER_BODY_FLAG = "caishenImageViewerOpen";
const IMAGE_VIEWER_CLOSING_FLAG = "caishenImageViewerClosing";

export const clampImageScale = (value: number) => Math.min(5, Math.max(1, value));

export const pointDistance = (first: Point, second: Point) =>
  Math.hypot(second.x - first.x, second.y - first.y);

const pointCenter = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

export function GestureImageViewer({
  open,
  src,
  alt,
  canPrevious = false,
  canNext = false,
  desktopNativeSize = false,
  onPrevious,
  onNext,
  onClose,
}: {
  open: boolean;
  src: string;
  alt: string;
  canPrevious?: boolean;
  canNext?: boolean;
  desktopNativeSize?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const isMobileOrTablet = useMobileOrTablet();
  const useDesktopNativeSize = desktopNativeSize && !isMobileOrTablet;
  const [transform, setTransform] = useState<Transform>({ scale: 1, position: { x: 0, y: 0 } });
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [gesturing, setGesturing] = useState(false);
  const transformRef = useRef(transform);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const suppressClickRef = useRef(false);
  const movedRef = useRef(false);
  const historyEntryRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const applyTransform = (scale: number, position: Point) => {
    const safeScale = clampImageScale(scale);
    const next = {
      scale: safeScale,
      position: safeScale === 1 && !useDesktopNativeSize ? { x: 0, y: 0 } : position,
    };
    transformRef.current = next;
    setTransform(next);
  };

  const reset = () => {
    pointersRef.current.clear();
    gestureRef.current = null;
    swipeStartRef.current = null;
    suppressClickRef.current = false;
    movedRef.current = false;
    setGesturing(false);
    applyTransform(1, { x: 0, y: 0 });
  };

  useEffect(() => {
    if (!open) return;
    setViewMode(useDesktopNativeSize ? "native" : "full");
    reset();
  }, [open, useDesktopNativeSize]);

  useEffect(() => {
    if (open) reset();
  }, [src]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset[IMAGE_VIEWER_BODY_FLAG] = "true";
    if (!window.history.state?.[IMAGE_VIEWER_HISTORY_MARKER]) {
      window.history.pushState(
        { ...(window.history.state ?? {}), [IMAGE_VIEWER_HISTORY_MARKER]: true },
        "",
        window.location.href,
      );
      historyEntryRef.current = true;
    }
    const closeFromHistory = () => {
      if (!historyEntryRef.current) return;
      historyEntryRef.current = false;
      onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (historyEntryRef.current && window.history.state?.[IMAGE_VIEWER_HISTORY_MARKER]) {
        historyEntryRef.current = false;
        document.body.dataset[IMAGE_VIEWER_CLOSING_FLAG] = "true";
        const clearClosingFlag = () => {
          delete document.body.dataset[IMAGE_VIEWER_CLOSING_FLAG];
          window.removeEventListener("popstate", clearClosingFlag);
        };
        window.addEventListener("popstate", clearClosingFlag);
        window.setTimeout(clearClosingFlag, 750);
        onCloseRef.current();
        window.history.back();
      } else {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", closeFromHistory);
    return () => {
      historyEntryRef.current = false;
      document.body.style.overflow = previousOverflow;
      if (document.body.dataset[IMAGE_VIEWER_BODY_FLAG] === "true") {
        delete document.body.dataset[IMAGE_VIEWER_BODY_FLAG];
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", closeFromHistory);
    };
  }, [open]);

  const closeViewer = () => {
    if (historyEntryRef.current && window.history.state?.[IMAGE_VIEWER_HISTORY_MARKER]) {
      historyEntryRef.current = false;
      document.body.dataset[IMAGE_VIEWER_CLOSING_FLAG] = "true";
      const clearClosingFlag = () => {
        delete document.body.dataset[IMAGE_VIEWER_CLOSING_FLAG];
        window.removeEventListener("popstate", clearClosingFlag);
      };
      window.addEventListener("popstate", clearClosingFlag);
      window.setTimeout(clearClosingFlag, 750);
      onCloseRef.current();
      window.history.back();
      return;
    }
    onCloseRef.current();
  };

  const localCenter = (element: HTMLDivElement, points: Point[]) => {
    const bounds = element.getBoundingClientRect();
    const center = pointCenter(points[0], points[1]);
    return { x: center.x - bounds.left - bounds.width / 2, y: center.y - bounds.top - bounds.height / 2 };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);
    const points = Array.from(pointersRef.current.values());
    setGesturing(true);
    movedRef.current = false;
    if (points.length >= 2) {
      swipeStartRef.current = null;
      const current = transformRef.current;
      gestureRef.current = {
        kind: "pinch",
        distance: pointDistance(points[0], points[1]),
        scale: current.scale,
        position: current.position,
        center: localCenter(event.currentTarget, points),
      };
    } else if (transformRef.current.scale > 1 || useDesktopNativeSize) {
      swipeStartRef.current = null;
      gestureRef.current = { kind: "drag", start: point, origin: transformRef.current.position };
    } else if (event.pointerType !== "mouse") {
      gestureRef.current = null;
      swipeStartRef.current = { ...point, pointerId: event.pointerId };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    const gesture = gestureRef.current;
    if (points.length >= 2 && gesture?.kind === "pinch") {
      movedRef.current = true;
      const currentCenter = localCenter(event.currentTarget, points);
      const nextScale = clampImageScale(gesture.scale * pointDistance(points[0], points[1]) / Math.max(gesture.distance, 1));
      const ratio = nextScale / gesture.scale;
      applyTransform(nextScale, {
        x: currentCenter.x - (gesture.center.x - gesture.position.x) * ratio,
        y: currentCenter.y - (gesture.center.y - gesture.position.y) * ratio,
      });
    } else if (points.length === 1 && gesture?.kind === "drag") {
      const dx = points[0].x - gesture.start.x;
      const dy = points[0].y - gesture.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
      applyTransform(transformRef.current.scale, { x: gesture.origin.x + dx, y: gesture.origin.y + dy });
    } else if (points.length === 1 && swipeStartRef.current?.pointerId === event.pointerId) {
      const dx = points[0].x - swipeStartRef.current.x;
      const dy = points[0].y - swipeStartRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) movedRef.current = true;
    }
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>, allowSwipe = true) => {
    const swipeStart = swipeStartRef.current?.pointerId === event.pointerId
      ? swipeStartRef.current
      : null;
    if (allowSwipe && swipeStart && transformRef.current.scale === 1) {
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        suppressClickRef.current = true;
        movedRef.current = true;
        if (dx < 0 && canNext) onNext?.();
        if (dx > 0 && canPrevious) onPrevious?.();
      }
    }
    if (swipeStart) swipeStartRef.current = null;
    pointersRef.current.delete(event.pointerId);
    const points = Array.from(pointersRef.current.values());
    gestureRef.current = points.length === 1 && (transformRef.current.scale > 1 || useDesktopNativeSize)
      ? { kind: "drag", start: points[0], origin: transformRef.current.position }
      : null;
    setGesturing(points.length > 0);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const current = transformRef.current;
    const nextScale = clampImageScale(current.scale * Math.exp(-event.deltaY * 0.0015));
    if (nextScale === current.scale) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const cursor = {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
    const ratio = nextScale / current.scale;
    applyTransform(nextScale, {
      x: cursor.x - (cursor.x - current.position.x) * ratio,
      y: cursor.y - (cursor.y - current.position.y) * ratio,
    });
  };

  const changeViewMode = (nextMode: ViewMode) => {
    setViewMode(nextMode);
    reset();
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!useDesktopNativeSize) return;
    event.preventDefault();
    const current = transformRef.current;
    if (current.scale > 1) {
      applyTransform(1, { x: 0, y: 0 });
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const cursor = {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
    applyTransform(2, {
      x: cursor.x - (cursor.x - current.position.x) * 2,
      y: cursor.y - (cursor.y - current.position.y) * 2,
    });
  };

  if (!open) return null;

  const hasNavigation = Boolean(onPrevious || onNext);
  const previousButton = canPrevious && onPrevious ? (
    <button
      type="button"
      onClick={onPrevious}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 active:scale-[.97]"
      aria-label="上一張圖片"
    >
      <ChevronLeft className="size-5" />上一張
    </button>
  ) : null;
  const nextButton = canNext && onNext ? (
    <button
      type="button"
      onClick={onNext}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 active:scale-[.97]"
      aria-label="下一張圖片"
    >
      下一張<ChevronRight className="size-5" />
    </button>
  ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] isolate bg-black/95 text-white backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${alt}放大預覽`}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2147483100] h-20 bg-gradient-to-b from-black/80 to-transparent" aria-hidden="true" />
      <p
        className="pointer-events-none fixed inset-x-4 top-[4.5rem] z-[2147483150] truncate text-center text-sm font-bold text-white/90 md:inset-x-48 md:top-[max(1.25rem,env(safe-area-inset-top))]"
        data-testid="image-viewer-filename"
      >
        {alt}
      </p>
      <button
        type="button"
        onClick={closeViewer}
        className="fixed z-[2147483200] inline-flex h-11 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-4 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 active:scale-[.97]"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left))",
          top: "max(0.75rem, env(safe-area-inset-top))",
        }}
        aria-label="返回頁面"
      >
        <ChevronLeft className="size-5" />返回
      </button>
      {!useDesktopNativeSize ? <div
        className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[2147483200] inline-flex rounded-full border border-white/20 bg-black/70 p-1 shadow-lg backdrop-blur-md"
        role="group"
        aria-label="圖片顯示方式"
      >
        <button
          type="button"
          onClick={() => changeViewMode("fitWidth")}
          className={`rounded-full px-3 py-2 text-xs font-bold transition active:scale-[.97] ${viewMode === "fitWidth" ? "bg-white text-black" : "text-white/80 hover:bg-white/15 hover:text-white"}`}
          aria-pressed={viewMode === "fitWidth"}
        >
          適合寬度
        </button>
        <button
          type="button"
          onClick={() => changeViewMode("full")}
          className={`rounded-full px-3 py-2 text-xs font-bold transition active:scale-[.97] ${viewMode === "full" ? "bg-white text-black" : "text-white/80 hover:bg-white/15 hover:text-white"}`}
          aria-pressed={viewMode === "full"}
        >
          完整圖片
        </button>
      </div> : null}
      <p className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 text-center text-xs font-semibold text-white/70">
        <span className="md:hidden">左右滑動換圖 · 雙指縮放 · 放大後拖曳</span>
        <span className="hidden md:inline">{useDesktopNativeSize ? "滑鼠滾輪縮放 · 雙擊放大／還原 · 按住拖曳" : "滑鼠滾輪／雙指縮放 · 放大後拖曳 · 點一下切換大小"}</span>
      </p>
      <div
        className={hasNavigation
          ? "relative z-0 grid size-full grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-3 p-3 pb-14 pt-28 md:pb-16 md:pt-20 lg:grid-cols-[9rem_minmax(0,1fr)_9rem] lg:grid-rows-1 lg:gap-5 lg:p-6 lg:pb-6 lg:pt-20"
          : "relative z-0 flex size-full items-center justify-center p-3 pb-14 pt-28 md:pt-20"}
      >
        {hasNavigation ? <div className="hidden items-center justify-center md:col-start-1 md:row-start-2 md:flex lg:col-start-1 lg:row-start-1" data-testid="previous-image-control-slot">{previousButton}</div> : null}
        <div
          className={hasNavigation
            ? "relative col-span-2 col-start-1 row-start-1 flex min-h-0 min-w-0 touch-none select-none items-center justify-center overflow-hidden lg:col-span-1 lg:col-start-2"
            : "relative flex min-h-0 min-w-0 touch-none select-none items-center justify-center overflow-hidden"}
          data-testid="image-viewer-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={event => endPointer(event, false)}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          onClick={() => {
            if (useDesktopNativeSize) return;
            if (movedRef.current || suppressClickRef.current) {
              movedRef.current = false;
              suppressClickRef.current = false;
              return;
            }
            const current = transformRef.current;
            applyTransform(current.scale > 1 ? 1 : 2, { x: 0, y: 0 });
          }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className={viewMode === "native"
              ? "h-auto w-auto max-h-none max-w-none shrink-0 object-contain will-change-transform"
              : viewMode === "fitWidth"
              ? "h-auto w-[95%] max-h-none max-w-none shrink-0 object-contain will-change-transform"
              : "h-auto w-auto max-h-[95%] max-w-[95%] shrink-0 object-contain will-change-transform"}
            style={{
              transform: `translate3d(${transform.position.x}px, ${transform.position.y}px, 0) scale(${transform.scale})`,
              cursor: gesturing ? "grabbing" : useDesktopNativeSize || transform.scale > 1 ? "grab" : "zoom-in",
              transition: gesturing ? "none" : "transform 160ms cubic-bezier(.23,1,.32,1)",
            }}
          />
        </div>
        {hasNavigation ? <div className="hidden items-center justify-center md:col-start-2 md:row-start-2 md:flex lg:col-start-3 lg:row-start-1" data-testid="next-image-control-slot">{nextButton}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
