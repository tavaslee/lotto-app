import { trpc } from "@/lib/trpc";
import { LOTTERY_CONFIG, type LotteryType } from "@shared/lottery";
import { GalleryHorizontalEnd, ImageOff, Maximize2 } from "lucide-react";
import React, { useState } from "react";
import { GestureImageViewer } from "./GestureImageViewer";

export function TrendGallery({ lotteryType }: { lotteryType: LotteryType }) {
  const query = trpc.trendImages.list.useQuery({ lotteryType });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const images = query.data ?? [];
  const activeImage = activeIndex === null ? undefined : images[activeIndex];
  const activeAlt = activeImage
    ? activeImage.caption || `${LOTTERY_CONFIG[lotteryType].name}版路圖 ${activeIndex! + 1}`
    : "版路圖片";

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-stone-100 p-5 sm:p-6">
        <p className="eyebrow">TREND BOARD</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950">
          <GalleryHorizontalEnd className="size-6 text-red-600" />{LOTTERY_CONFIG[lotteryType].name}版路拖牌
        </h1>
        <p className="mt-1 text-sm text-stone-500">點選圖片即可全螢幕檢視；電腦可使用上一張／下一張，手機可左右滑動換圖並雙指縮放。</p>
      </div>
      {query.isError ? (
        <div className="grid min-h-72 place-items-center p-8 text-center text-sm font-semibold text-red-600"><span><ImageOff className="mx-auto mb-3 size-8" />版路圖片讀取失敗<br /><small className="mt-2 block font-medium text-stone-400">{query.error.message}</small></span></div>
      ) : query.isLoading ? (
        <div className="grid min-h-72 place-items-center text-sm font-semibold text-stone-400">正在讀取版路圖片…</div>
      ) : query.data?.length ? (
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          {images.map((image, index) => {
            const alt = image.caption || `${LOTTERY_CONFIG[lotteryType].name}版路圖 ${index + 1}`;
            return (
              <button type="button" key={image.id} onClick={() => setActiveIndex(index)} className="group overflow-hidden rounded-2xl border border-stone-100 bg-stone-50 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex aspect-[4/3] items-start justify-center overflow-hidden bg-stone-100" data-testid="trend-image-frame">
                  <img src={image.url} alt={alt} className="h-auto w-[95%] max-w-none shrink-0 object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
                </div>
                <div className="relative flex items-center justify-center bg-white px-10 py-3">
                  <span className="block w-full truncate text-center text-sm font-bold text-stone-700">{image.caption || `版路圖 ${index + 1}`}</span>
                  <Maximize2 className="absolute right-4 size-4 text-stone-400" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-72 place-items-center p-8 text-center text-sm font-semibold text-stone-400"><span><ImageOff className="mx-auto mb-3 size-8" />目前尚未上傳此彩別的版路圖片</span></div>
      )}
      <GestureImageViewer
        open={Boolean(activeImage)}
        src={activeImage?.url ?? ""}
        alt={activeAlt}
        desktopNativeSize
        canPrevious={activeIndex !== null && activeIndex > 0}
        canNext={activeIndex !== null && activeIndex < images.length - 1}
        onPrevious={() => setActiveIndex(index => index === null ? null : Math.max(0, index - 1))}
        onNext={() => setActiveIndex(index => index === null ? null : Math.min(images.length - 1, index + 1))}
        onClose={() => setActiveIndex(null)}
      />
    </section>
  );
}
