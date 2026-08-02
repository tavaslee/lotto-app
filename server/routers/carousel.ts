import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCarouselSlide,
  deleteCarouselSlide,
  deleteCarouselSlides,
  getCarouselSettings,
  listCarouselSlides,
  saveCarouselSettings,
  reorderCarouselSlides,
  updateCarouselSlide,
} from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { adminMemberProcedure } from "../procedures";
import { uploadCarouselImage } from "../services/carousel";
import { storageErase } from "../storage";

const intervalSecondsSchema = z
  .number()
  .min(0.5)
  .max(10)
  .refine(value => Number.isInteger(value * 2), "秒數必須以 0.5 秒為間隔");

export const carouselRouter = router({
  publicView: publicProcedure.query(async () => {
    const settings = await getCarouselSettings();
    const slides = settings.isVisible ? await listCarouselSlides(false) : [];
    return { settings, slides };
  }),
  adminView: adminMemberProcedure.query(async () => ({
    settings: await getCarouselSettings(),
    slides: await listCarouselSlides(true),
  })),
  upload: adminMemberProcedure
    .input(z.object({ base64Data: z.string().min(1), fileName: z.string().min(1).max(255), mimeType: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      const stored = await uploadCarouselImage(input);
      const slides = await listCarouselSlides(true);
      return createCarouselSlide({
        url: stored.url,
        storageKey: stored.key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        isActive: false,
        sortOrder: slides.length,
      });
    }),
  setActive: adminMemberProcedure
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const slide = await updateCarouselSlide(input.id, { isActive: input.isActive });
      if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "找不到輪播圖片" });
      return slide;
    }),
  remove: adminMemberProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const slide = (await listCarouselSlides(true)).find(item => item.id === input.id);
      if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "找不到輪播圖片" });
      await storageErase(slide.storageKey);
      await deleteCarouselSlide(input.id);
      return { success: true };
    }),
  removeMany: adminMemberProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }).refine(input => new Set(input.ids).size === input.ids.length, "圖片不可重複"))
    .mutation(async ({ input }) => {
      const slides = (await listCarouselSlides(true)).filter(slide => input.ids.includes(slide.id));
      if (slides.length !== input.ids.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "部分輪播圖片已不存在，請重新整理" });
      }
      await deleteCarouselSlides(input.ids);
      const cleanup = await Promise.allSettled(slides.map(slide => storageErase(slide.storageKey)));
      return {
        success: true,
        deleted: slides.length,
        cleanupFailures: cleanup.filter(result => result.status === "rejected").length,
      };
    }),
  reorder: adminMemberProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).max(200) }).refine(input => new Set(input.ids).size === input.ids.length, "圖片不可重複"))
    .mutation(async ({ input }) => {
      try {
        return await reorderCarouselSlides(input.ids);
      } catch (error) {
        throw new TRPCError({
          code: "CONFLICT",
          message: error instanceof Error ? error.message : "輪播排序儲存失敗",
        });
      }
    }),
  updateSettings: adminMemberProcedure
    .input(z.object({ isVisible: z.boolean(), autoplay: z.boolean(), intervalSeconds: intervalSecondsSchema }))
    .mutation(({ input }) => saveCarouselSettings({
      isVisible: input.isVisible,
      autoplay: input.autoplay,
      intervalMs: Math.round(input.intervalSeconds * 1000),
    })),
});
