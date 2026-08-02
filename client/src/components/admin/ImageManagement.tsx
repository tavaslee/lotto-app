import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { LOTTERY_CONFIG, LOTTERY_TYPES, type LotteryType, type TrendImage } from "@shared/lottery";
import {
  CheckSquare2,
  CloudDownload,
  Eye,
  FolderSync,
  ImageIcon,
  Link2,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CarouselManagement } from "./CarouselManagement";
import { SortableImageGrid } from "./SortableImageGrid";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("無法讀取圖片"));
    reader.readAsDataURL(file);
  });

export function ImageManagement() {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lotteryType, setLotteryType] = useState<LotteryType>("lotto649");
  const [preview, setPreview] = useState<TrendImage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryInput = { lotteryType } as const;
  const query = trpc.trendImages.adminList.useQuery(queryInput);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [lotteryType]);

  const refresh = async () => {
    await Promise.all([
      utils.trendImages.adminList.invalidate(queryInput),
      utils.trendImages.list.invalidate(queryInput),
    ]);
  };

  const addUrl = trpc.trendImages.addUrl.useMutation({
    onSuccess: async () => {
      toast.success("圖片網址已加入");
      await refresh();
    },
    onError: error => toast.error("新增失敗", { description: error.message }),
  });
  const upload = trpc.trendImages.upload.useMutation();
  const remove = trpc.trendImages.delete.useMutation({
    onSuccess: async () => {
      toast.success("版路圖片已刪除");
      await refresh();
    },
    onError: error => toast.error("刪除失敗", { description: error.message }),
  });
  const removeMany = trpc.trendImages.deleteMany.useMutation({
    onSuccess: async result => {
      setSelectedIds(new Set());
      toast.success(`已刪除 ${result.deleted} 張版路圖片`, {
        description: result.cleanupFailures ? `${result.cleanupFailures} 個舊檔清理失敗，資料引用已移除。` : undefined,
      });
      await refresh();
    },
    onError: error => toast.error("批次刪除失敗", { description: error.message }),
  });
  const reorder = trpc.trendImages.reorder.useMutation({
    onMutate: async input => {
      await utils.trendImages.adminList.cancel({ lotteryType: input.lotteryType });
      const previous = utils.trendImages.adminList.getData({ lotteryType: input.lotteryType });
      const byId = new Map(previous?.map(image => [image.id, image]));
      utils.trendImages.adminList.setData(
        { lotteryType: input.lotteryType },
        input.ids.map((id, sortOrder) => ({ ...byId.get(id)!, sortOrder })),
      );
      return { previous };
    },
    onError: (error, input, context) => {
      utils.trendImages.adminList.setData({ lotteryType: input.lotteryType }, context?.previous);
      toast.error("排序儲存失敗", { description: error.message });
    },
    onSuccess: () => toast.success("版路圖片順序已儲存"),
    onSettled: async (_data, _error, input) => {
      await utils.trendImages.adminList.invalidate({ lotteryType: input.lotteryType });
      await utils.trendImages.list.invalidate({ lotteryType: input.lotteryType });
    },
  });
  const drivePreview = trpc.trendImages.drivePreview.useMutation({
    onError: error => toast.error("Google Drive 檢查失敗", { description: error.message, duration: 9000 }),
  });
  const driveSync = trpc.trendImages.driveSync.useMutation({
    onSuccess: async result => {
      drivePreview.reset();
      toast.success("Google Drive 完全鏡像同步完成", {
        description: `新增 ${result.added}、更新 ${result.updated}、刪除 ${result.deleted}、未變更 ${result.unchanged}`,
      });
      await refresh();
    },
    onError: error => toast.error("鏡像同步失敗", { description: error.message, duration: 9000 }),
  });

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    addUrl.mutate({
      lotteryType,
      url: String(data.get("url") ?? ""),
      caption: String(data.get("caption") ?? ""),
      sortOrder: Number(data.get("sortOrder") ?? query.data?.length ?? 0),
    });
    event.currentTarget.reset();
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    let completed = 0;
    for (const file of selected) {
      try {
        setUploadProgress(`正在上傳 ${file.name}（${completed + 1}/${selected.length}）`);
        await upload.mutateAsync({
          lotteryType,
          base64Data: await fileToDataUrl(file),
          fileName: file.name,
          mimeType: file.type,
          caption: file.name.replace(/\.[^.]+$/, ""),
          sortOrder: (query.data?.length ?? 0) + completed,
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
      toast.success(`已上傳 ${completed} 張圖片至本站儲存空間`);
      await refresh();
    }
  };

  const images = query.data ?? [];
  const allSelected = images.length > 0 && selectedIds.size === images.length;
  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div>
          <p className="eyebrow">TREND IMAGES</p>
          <h2 className="mt-1 text-2xl font-black text-stone-950">版路多圖管理中心</h2>
          <p className="mt-2 text-sm text-stone-500">支援本機上傳、外部網址與 Google Drive 完全鏡像；可多選刪除並跨裝置拖曳排序。</p>
        </div>
      </div>

      <CarouselManagement />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><UploadCloud className="size-5" /></span>
            <div><h3 className="font-black text-stone-900">從本機上傳多張圖片</h3><p className="text-xs text-stone-400">JPG、PNG、WebP、GIF、AVIF，每張最多 8 MB</p></div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={event => {
              if (event.target.files) void uploadFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            disabled={Boolean(uploadProgress)}
            onClick={() => inputRef.current?.click()}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
            className="grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 p-4 text-center hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60"
          >
            {uploadProgress ? (
              <span><Loader2 className="mx-auto mb-3 size-7 animate-spin text-orange-500" /><strong className="text-sm text-stone-700">{uploadProgress}</strong></span>
            ) : (
              <span><UploadCloud className="mx-auto mb-3 size-8 text-orange-500" /><strong className="block text-sm text-stone-700">選擇或拖曳多張圖片</strong><small className="mt-1 block text-stone-400">逐張安全寫入本站儲存空間</small></span>
            )}
          </button>
        </section>

        <form onSubmit={submitUrl} className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Link2 className="size-5" /></span>
            <div><h3 className="font-black text-stone-900">加入外部圖片網址</h3><p className="text-xs text-stone-400">支援 http／https 公開圖片連結</p></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="image-url">圖片網址</Label><Input id="image-url" name="url" type="url" required placeholder="https://example.com/trend.jpg" /></div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5"><Label htmlFor="caption">圖片說明</Label><Input id="caption" name="caption" placeholder="本週版路" /></div>
            <div className="space-y-1.5"><Label htmlFor="sort-order">排序</Label><Input id="sort-order" name="sortOrder" type="number" min={0} defaultValue={images.length} /></div>
          </div>
          <Button type="submit" disabled={addUrl.isPending}>{addUrl.isPending ? "新增中…" : "加入圖片網址"}</Button>
        </form>

        <section className="surface-card space-y-4 border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CloudDownload className="size-5" /></span>
            <div><h3 className="font-black text-stone-900">從雲端硬碟匯入圖片</h3><p className="text-xs text-stone-500">完全鏡像目前彩別的指定資料夾</p></div>
          </div>
          <p className="text-sm leading-6 text-stone-600">
            只讀取 <strong>「版路{LOTTERY_TYPES.indexOf(lotteryType) + 1}-{lotteryType === "markSix" ? "六合彩" : LOTTERY_CONFIG[lotteryType].name}」</strong> 第一層圖片，不讀子資料夾。完全鏡像後此資料夾會成為本彩別唯一圖片來源；Drive 中不存在的既有圖片也會從網站刪除。
          </p>
          <Button
            type="button"
            className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={drivePreview.isPending || driveSync.isPending}
            onClick={() => drivePreview.mutate({ lotteryType })}
          >
            {drivePreview.isPending ? <Loader2 className="size-4 animate-spin" /> : <FolderSync className="size-4" />}
            {drivePreview.isPending ? "正在檢查雲端硬碟…" : "檢查變更並同步"}
          </Button>
        </section>
      </div>

      <section
        data-testid="trend-lottery-selector"
        aria-labelledby="trend-lottery-selector-title"
        className="surface-card overflow-hidden border-orange-100 bg-gradient-to-r from-white via-orange-50/45 to-white p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="shrink-0">
            <p className="eyebrow">MANAGE LOTTERY</p>
            <h3 id="trend-lottery-selector-title" className="mt-1 font-black text-stone-950">管理彩別</h3>
            <p className="mt-1 text-xs text-stone-500">選擇要管理的版路圖片</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:max-w-4xl xl:grid-cols-5" role="group" aria-label="管理彩別">
            {LOTTERY_TYPES.map((type, index) => {
              const selected = lotteryType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    drivePreview.reset();
                    setLotteryType(type);
                  }}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition-[background-color,border-color,color,box-shadow,transform] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                    selected
                      ? "border-orange-500 bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-[0_7px_18px_rgba(234,88,12,.24)]"
                      : "border-stone-200 bg-white text-stone-700 shadow-sm hover:border-orange-300 hover:bg-orange-50 hover:text-red-700"
                  }`}
                >
                  <span className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-black ${selected ? "bg-white/20 text-white" : "bg-stone-100 text-stone-400"}`}>
                    {index + 1}
                  </span>
                  <span>{LOTTERY_CONFIG[type].name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h3 className="font-black text-stone-900">{LOTTERY_CONFIG[lotteryType].name} 圖片</h3>
            <p className="mt-1 text-xs text-stone-400">共 {images.length} 張；使用拖曳把手調整順序，手機需長按後拖曳。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {images.length ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(images.map(image => image.id)))}
              >
                <CheckSquare2 className="size-4" />{allSelected ? "取消全選" : "全選"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!selectedIds.size || removeMany.isPending}
              onClick={() => {
                if (confirm(`確定刪除已選取的 ${selectedIds.size} 張版路圖片？此操作無法復原。`)) {
                  removeMany.mutate({ lotteryType, ids: Array.from(selectedIds) });
                }
              }}
            >
              {removeMany.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              刪除已選（{selectedIds.size}）
            </Button>
          </div>
        </div>

        {query.isError ? (
          <div className="p-10 text-center text-sm font-semibold text-red-600">讀取失敗：{query.error.message}</div>
        ) : query.isLoading ? (
          <div className="grid min-h-48 place-items-center text-sm font-semibold text-stone-400"><Loader2 className="mb-2 size-5 animate-spin" />讀取圖片中…</div>
        ) : images.length ? (
          <SortableImageGrid
            ids={images.map(image => image.id)}
            disabled={reorder.isPending || removeMany.isPending}
            className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3"
            onReorder={ids => reorder.mutate({ lotteryType, ids: ids.map(String) })}
          >
            {(id, dragHandle) => {
              const image = images.find(item => item.id === id)!;
              const checked = selectedIds.has(image.id);
              return (
                <article className={`group overflow-hidden rounded-2xl border bg-white transition-shadow ${checked ? "border-orange-400 ring-2 ring-orange-100" : "border-stone-200"}`}>
                  <div className="relative">
                    <button type="button" onClick={() => setPreview(image)} className="relative block aspect-[4/3] w-full overflow-hidden bg-stone-100">
                      <img src={image.url} alt={image.caption || `${LOTTERY_CONFIG[image.lotteryType].name}版路`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"><Eye className="size-7" /></span>
                    </button>
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-2 py-1.5 text-xs font-bold text-stone-700 shadow-sm">
                      <Checkbox checked={checked} onCheckedChange={value => toggleSelection(image.id, value === true)} aria-label={`選取 ${image.caption || image.id}`} />
                      選取
                    </label>
                    <span className="absolute right-2 top-2">{dragHandle}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-stone-800">{image.caption || "未命名圖片"}</p>
                      <p className="mt-1 text-[11px] font-semibold text-stone-400">
                        {image.source === "upload" ? "本站上傳" : image.source === "google-drive" ? "Google Drive 鏡像" : "外部網址"} · 排序 {image.sortOrder}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-stone-400 hover:text-red-600"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm("確定刪除此版路圖片？")) remove.mutate({ id: image.id });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </article>
              );
            }}
          </SortableImageGrid>
        ) : (
          <div className="grid min-h-48 place-items-center p-8 text-center text-sm font-semibold text-stone-400"><span><ImageIcon className="mx-auto mb-3 size-8 text-stone-300" />此彩別尚未建立版路圖片</span></div>
        )}
      </section>

      <AlertDialog open={Boolean(drivePreview.data)} onOpenChange={open => !open && !driveSync.isPending && drivePreview.reset()}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>確認 Google Drive 完全鏡像</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <span className="block">資料夾：<strong>{drivePreview.data?.folder.name}</strong>（只讀第一層）</span>
              <span className="grid grid-cols-4 gap-2 text-center">
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><strong className="block text-lg">{drivePreview.data?.additions.length ?? 0}</strong>新增</span>
                <span className="rounded-xl bg-blue-50 p-2 text-blue-800"><strong className="block text-lg">{drivePreview.data?.updates.length ?? 0}</strong>更新</span>
                <span className="rounded-xl bg-red-50 p-2 text-red-800"><strong className="block text-lg">{drivePreview.data?.deletions.length ?? 0}</strong>刪除</span>
                <span className="rounded-xl bg-stone-100 p-2 text-stone-700"><strong className="block text-lg">{drivePreview.data?.unchangedCount ?? 0}</strong>未變</span>
              </span>
              {(drivePreview.data?.deletions.length ?? 0) > 0 ? <span className="block rounded-xl bg-red-50 p-3 font-semibold text-red-700">完全鏡像會刪除所有不在 Drive 指定資料夾第一層的既有版路圖片，包括先前由本機上傳或外部網址加入的圖片。</span> : null}
              {(drivePreview.data?.skipped.length ?? 0) > 0 ? <span className="block rounded-xl bg-amber-50 p-3 text-amber-800">有 {drivePreview.data?.skipped.length} 張圖片因格式或大小限制略過，既有網站副本不會被刪除。</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={driveSync.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={driveSync.isPending || !drivePreview.data}
              onClick={event => {
                event.preventDefault();
                if (drivePreview.data) driveSync.mutate({ lotteryType, fingerprint: drivePreview.data.fingerprint });
              }}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {driveSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <FolderSync className="size-4" />}
              套用完全鏡像
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(preview)} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-5xl border-0 bg-stone-950 p-2 text-white">
          <DialogTitle className="sr-only">圖片預覽</DialogTitle>
          {preview ? <><img src={preview.url} alt={preview.caption || "版路圖片"} className="max-h-[82vh] w-full object-contain" /><button type="button" onClick={() => setPreview(null)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60"><X className="size-5" /></button></> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
