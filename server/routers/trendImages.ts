import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { LOTTERY_TYPES } from "../../shared/lottery";
import { router } from "../_core/trpc";
import { adminMemberProcedure, memberProcedure } from "../procedures";
import { applyDriveMirror, previewDriveMirror, StaleDriveMirrorPlanError } from "../services/driveMirror";
import { deleteTrendImage, listTrendImages, replaceTrendImagesForLottery, upsertTrendImage } from "../services/googleSheets";
import { canAccessLotteryType, resolveEffectivePermissions } from "../services/memberAuth";
import { uploadTrendImage, validateExternalImageUrl } from "../services/trendImages";
import { storageErase } from "../storage";

const lotteryTypeSchema = z.enum(LOTTERY_TYPES);

export const trendImagesRouter = router({
  list: memberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema }))
    .query(async ({ ctx, input }) => {
      if (!canAccessLotteryType(ctx.member, input.lotteryType)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員尚未開放此彩別" });
      }
      const permissions = await resolveEffectivePermissions(ctx.member);
      if (!permissions.trendBoard) {
        throw new TRPCError({ code: "FORBIDDEN", message: "您的會員權限尚未開放版路拖牌" });
      }
      return listTrendImages(input.lotteryType);
    }),

  adminList: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema.optional() }))
    .query(({ input }) => listTrendImages(input.lotteryType)),

  addUrl: adminMemberProcedure
    .input(
      z.object({
        lotteryType: lotteryTypeSchema,
        url: z.string().trim().min(1),
        caption: z.string().trim().max(120).default(""),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      return upsertTrendImage({
        id: crypto.randomUUID(),
        lotteryType: input.lotteryType,
        url: validateExternalImageUrl(input.url),
        storageKey: null,
        source: "external",
        caption: input.caption,
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }),

  upload: adminMemberProcedure
    .input(
      z.object({
        lotteryType: lotteryTypeSchema,
        base64Data: z.string().min(1),
        fileName: z.string().min(1).max(160),
        mimeType: z.string().min(1),
        caption: z.string().trim().max(120).default(""),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const stored = await uploadTrendImage(input);
      const now = new Date().toISOString();
      return upsertTrendImage({
        id: crypto.randomUUID(),
        lotteryType: input.lotteryType,
        url: stored.url,
        storageKey: stored.key,
        source: "upload",
        caption: input.caption,
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }),

  delete: adminMemberProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    const image = (await listTrendImages()).find(item => item.id === input.id);
    if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "找不到版路圖片" });
    await deleteTrendImage(input.id);
    if (image.storageKey) await storageErase(image.storageKey);
    return { success: true };
  }),

  deleteMany: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema, ids: z.array(z.string().min(1)).min(1).max(200) }).refine(input => new Set(input.ids).size === input.ids.length, "圖片不可重複"))
    .mutation(async ({ input }) => {
      const current = await listTrendImages(input.lotteryType);
      const selected = current.filter(image => input.ids.includes(image.id));
      if (selected.length !== input.ids.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "部分版路圖片已不存在，請重新整理" });
      }
      await replaceTrendImagesForLottery(
        input.lotteryType,
        current.filter(image => !input.ids.includes(image.id)),
      );
      const cleanup = await Promise.allSettled(
        selected.filter(image => image.storageKey).map(image => storageErase(image.storageKey as string)),
      );
      return {
        success: true,
        deleted: selected.length,
        cleanupFailures: cleanup.filter(result => result.status === "rejected").length,
      };
    }),

  reorder: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema, ids: z.array(z.string().min(1)).max(500) }).refine(input => new Set(input.ids).size === input.ids.length, "圖片不可重複"))
    .mutation(async ({ input }) => {
      const current = await listTrendImages(input.lotteryType);
      const currentIds = current.map(image => image.id).sort();
      const nextIds = [...input.ids].sort();
      if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
        throw new TRPCError({ code: "CONFLICT", message: "版路圖片清單已變更，請重新整理後再試" });
      }
      const byId = new Map(current.map(image => [image.id, image]));
      const reordered = input.ids.map((id, sortOrder) => ({ ...byId.get(id)!, sortOrder }));
      await replaceTrendImagesForLottery(input.lotteryType, reordered);
      return reordered;
    }),

  drivePreview: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema }))
    .mutation(({ input }) => previewDriveMirror(input.lotteryType)),

  driveSync: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema, fingerprint: z.string().length(64) }))
    .mutation(async ({ input }) => {
      try {
        return await applyDriveMirror(input.lotteryType, input.fingerprint);
      } catch (error) {
        if (error instanceof StaleDriveMirrorPlanError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),
});
