import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  CheckSquare2,
  Eye,
  Images,
  Loader2,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ACCEPTED_CAROUSEL_TYPES,
  getCarouselFileValidationError,
  isValidCarouselInterval,
} from "./carouselRules";
import { SortableImageGrid } from "./SortableImageGrid";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("無法讀取圖片"));
    reader.readAsDataURL(file);
  });

export function CarouselManagement() {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const query = trpc.carousel.adminView.useQuery();
  useEffect(() => {
    if (!query.data) return;
    setIsVisible(query.data.settings.isVisible);
    setAutoplay(query.data.settings.autoplay);
    setIntervalSeconds(query.data.settings.intervalMs / 1000);
    setSelectedIds(current => new Set(Array.from(current).filter(id => query.data?.slides.some(slide => slide.id === id))));
  }, [query.data]);

  const refresh = async () => {
    await Promise.all([
      utils.carousel.adminView.invalidate(),
      utils.carousel.publicView.invalidate(),
    ]);
  };

  const upload = trpc.carousel.upload.useMutation();
  const setActive = trpc.carousel.setActive.useMutation({
    onSuccess: async slide => {
      toast.success(slide.isActive ? "輪播圖片已上架" : "輪播圖片已下架");
      await refresh();
    },
    onError: error => toast.error("狀態更新失敗", { description: error.message }),
  });
  const remove = trpc.carousel.remove.useMutation({
    onSuccess: async () => {
      toast.success("輪播圖片已刪除");
      await refresh();
    },
    onError: error => toast.error("刪除失敗", { description: error.message }),
  });
  const removeMany = trpc.carousel.removeMany.useMutation({
    onSuccess: async result => {
      setSelectedIds(new Set());
      toast.success(`已刪除 ${result.deleted} 張輪播圖片`, {
        description: result.cleanupFailures ? `${result.cleanupFailures} 個舊檔清理失敗，輪播引用已移除。` : undefined,
      });
      await refresh();
    },
    onError: error => toast.error("批次刪除失敗", { description: error.message }),
  });
  const reorder = trpc.carousel.reorder.useMutation({
    onMutate: async input => {
      await utils.carousel.adminView.cancel();
      const previous = utils.carousel.adminView.getData();
      utils.carousel.adminView.setData(undefined, current => {
        if (!current) return current;
        const byId = new Map(current.slides.map(slide => [slide.id, slide]));
        return {
          ...current,
          slides: input.ids.map((id, sortOrder) => ({ ...byId.get(id)!, sortOrder })),
        };
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.carousel.adminView.setData(undefined, context?.previous);
      toast.error("輪播排序儲存失敗", { description: error.message });
    },
    onSuccess: () => toast.success("輪播圖片順序已儲存"),
    onSettled: refresh,
  });
  const saveSettings = trpc.carousel.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("輪播設定已儲存");
      await refresh();
    },
    onError: error => toast.error("設定儲存失敗", { description: error.message }),
  });

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    let completed = 0;
    for (const file of selected) {
      const validationError = getCarouselFileValidationError(file);
      if (validationError === "type") {
        toast.error(`${file.name} 格式不支援`, { description: "請使用 JPG、PNG、WebP、GIF 或 AVIF" });
        continue;
      }
      if (validationError === "size") {
        toast.error(`${file.name} 大小必須介於 1 byte 與 8 MB 之間`);
        continue;
      }
      try {
        setUploadProgress(`正在上傳 ${file.name}（${completed + 1}/${selected.length}）`);
        await upload.mutateAsync({
          base64Data: await fileToDataUrl(file),
          fileName: file.name,
          mimeType: file.type,
        });
        completed += 1;
      } catch (error) {
        toast.error(`${file.name} 上傳失敗`, {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    }
    setUploadProgress(null);
    if (completed) {
      toast.success(`已上傳 ${completed} 張輪播圖片`, { description: "新圖片預設為下架狀態" });
      await refresh();
    }
  };

  const slides = query.data?.slides ?? [];
  const allSelected = slides.length > 0 && selectedIds.size === slides.length;
  const intervalIsValid = isValidCarouselInterval(intervalSeconds);
  const toggleSelection = (id: number, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-stone-100 bg-gradient-to-r from-amber-50 via-white to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Images className="size-5" /></span>
            <div>
              <p className="eyebrow">HOME CAROUSEL</p>
              <h3 className="mt-1 text-xl font-black text-stone-950">首頁廣告輪播</h3>
              <p className="mt-1 text-sm leading-6 text-stone-500">管理首頁廣告圖片；可多選刪除，並以桌機滑鼠或手機長按拖曳排序。</p>
            </div>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-500 shadow-sm ring-1 ring-stone-200">{slides.length} 張圖片</span>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 p-4">
            <div><Label htmlFor="carousel-visible" className="font-black text-stone-900">前台顯示輪播</Label><p className="mt-1 text-xs leading-5 text-stone-400">關閉後整個輪播區塊會從首頁隱藏。</p></div>
            <Switch id="carousel-visible" checked={isVisible} onCheckedChange={setIsVisible} />
          </div>

          <div className="rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div><Label htmlFor="carousel-autoplay" className="font-black text-stone-900">自動換圖</Label><p className="mt-1 text-xs leading-5 text-stone-400">關閉後停止自動播放，仍可手動切換。</p></div>
              <Switch id="carousel-autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
            </div>
            <div className="mt-4 space-y-1.5 border-t border-stone-100 pt-4">
              <Label htmlFor="carousel-interval">換圖間隔（秒）</Label>
              <div className="flex items-center gap-3">
                <Input id="carousel-interval" type="number" inputMode="decimal" min={0.5} max={10} step={0.5} value={intervalSeconds} onChange={event => setIntervalSeconds(Number(event.target.value))} className="max-w-32 font-bold" />
                <span className="text-xs font-semibold text-stone-400">0.5～10 秒</span>
              </div>
              {!intervalIsValid ? <p className="text-xs font-semibold text-red-600">請輸入 0.5～10，並以 0.5 秒為間隔。</p> : null}
            </div>
          </div>

          <Button type="button" disabled={!intervalIsValid || saveSettings.isPending} onClick={() => saveSettings.mutate({ isVisible, autoplay, intervalSeconds })}>
            {saveSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}儲存輪播設定
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><UploadCloud className="size-5" /></span>
            <div><h4 className="font-black text-stone-900">上傳輪播圖片</h4><p className="text-xs text-stone-400">JPG、PNG、WebP、GIF、AVIF，每張最多 8 MB</p></div>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_CAROUSEL_TYPES.join(",")} multiple className="hidden" onChange={event => { if (event.target.files) void uploadFiles(event.target.files); event.currentTarget.value = ""; }} />
          <button type="button" disabled={Boolean(uploadProgress)} onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }} className="grid min-h-44 w-full place-items-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 p-5 text-center transition-colors hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60">
            {uploadProgress ? <span><Loader2 className="mx-auto mb-3 size-7 animate-spin text-amber-600" /><strong className="text-sm text-stone-700">{uploadProgress}</strong></span> : <span><UploadCloud className="mx-auto mb-3 size-8 text-amber-600" /><strong className="block text-sm text-stone-700">選擇或拖曳多張圖片</strong><small className="mt-1 block text-stone-400">圖片上傳後預設為下架</small></span>}
          </button>
        </div>
      </div>

      <div className="border-t border-stone-100 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-stone-500">使用每張圖片右上角的拖曳把手調整順序；手機需長按後拖曳。</p>
          <div className="flex flex-wrap gap-2">
            {slides.length ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(slides.map(slide => slide.id)))}>
                <CheckSquare2 className="size-4" />{allSelected ? "取消全選" : "全選"}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="destructive" disabled={!selectedIds.size || removeMany.isPending} onClick={() => {
              if (confirm(`確定刪除已選取的 ${selectedIds.size} 張輪播圖片？刪除後無法復原。`)) removeMany.mutate({ ids: Array.from(selectedIds) });
            }}>
              {removeMany.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}刪除已選（{selectedIds.size}）
            </Button>
          </div>
        </div>

        {query.isError ? (
          <div className="rounded-2xl bg-red-50 p-6 text-center text-sm font-semibold text-red-700">讀取失敗：{query.error.message}</div>
        ) : query.isLoading ? (
          <div className="grid min-h-44 place-items-center text-sm font-semibold text-stone-400"><Loader2 className="mb-2 size-5 animate-spin" />讀取輪播圖片中…</div>
        ) : slides.length ? (
          <SortableImageGrid
            ids={slides.map(slide => slide.id)}
            disabled={reorder.isPending || removeMany.isPending}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            onReorder={ids => reorder.mutate({ ids: ids.map(Number) })}
          >
            {(id, dragHandle) => {
              const slide = slides.find(item => item.id === id)!;
              const checked = selectedIds.has(slide.id);
              return (
                <article className={`overflow-hidden rounded-2xl border bg-white ${checked ? "border-amber-400 ring-2 ring-amber-100" : "border-stone-200"}`}>
                  <div className="relative">
                    <button type="button" onClick={() => setPreview(slide.url)} className="group relative block aspect-[3/1] w-full overflow-hidden bg-stone-100">
                      <img src={slide.url} alt={slide.fileName} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"><Eye className="size-6" /></span>
                    </button>
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-2 py-1.5 text-xs font-bold text-stone-700 shadow-sm">
                      <Checkbox checked={checked} onCheckedChange={value => toggleSelection(slide.id, value === true)} aria-label={`選取 ${slide.fileName}`} />選取
                    </label>
                    <span className="absolute right-2 top-2">{dragHandle}</span>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-bold text-stone-800">{slide.fileName}</p><p className="mt-1 text-[11px] font-semibold uppercase text-stone-400">{slide.mimeType.replace("image/", "")} · 排序 {slide.sortOrder}</p></div>
                      <span className={slide.isActive ? "rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700" : "rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-500"}>{slide.isActive ? "已上架" : "已下架"}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="flex-1" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: slide.id, isActive: !slide.isActive })}>
                        {slide.isActive ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}{slide.isActive ? "下架" : "上架"}
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" className="text-stone-400 hover:text-red-600" disabled={remove.isPending} onClick={() => { if (confirm("確定刪除此輪播圖片？刪除後無法復原。")) remove.mutate({ id: slide.id }); }} aria-label={`刪除 ${slide.fileName}`}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </article>
              );
            }}
          </SortableImageGrid>
        ) : (
          <div className="grid min-h-44 place-items-center rounded-2xl bg-stone-50 p-8 text-center text-sm font-semibold text-stone-400"><span><Images className="mx-auto mb-3 size-8 text-stone-300" />尚未上傳首頁輪播圖片</span></div>
        )}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-6xl border-0 bg-stone-950 p-2 text-white">
          <DialogTitle className="sr-only">輪播圖片預覽</DialogTitle>
          {preview ? <><img src={preview} alt="輪播圖片預覽" className="max-h-[82vh] w-full object-contain" /><button type="button" onClick={() => setPreview(null)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60" aria-label="關閉預覽"><X className="size-5" /></button></> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
