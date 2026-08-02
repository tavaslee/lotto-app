import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ANALYSIS_PERMISSION_KEYS, LOTTERY_TYPES } from "../../shared/lottery";
import { publicProcedure, router } from "../_core/trpc";
import { adminMemberProcedure, memberProcedure, optionalMemberProcedure } from "../procedures";
import { batchUpsertDraws, deleteDraw, listDraws, upsertDraw } from "../services/googleSheets";
import { canAccessLotteryType, resolveAllowedLotteryTypes, resolveEffectivePermissions } from "../services/memberAuth";
import { calculateOmissionContext } from "../services/analysis";
import { rocDateToIso, validateDrawNumbers, validateSpecialNumber } from "../utils/lottery";

const lotteryTypeSchema = z.enum(LOTTERY_TYPES);
const analysisBaseInput = z.object({
  lotteryType: lotteryTypeSchema,
  tool: z.enum(ANALYSIS_PERMISSION_KEYS),
  includeSpecial: z.boolean().default(false),
});
const analysisInput = z.discriminatedUnion("rangeMode", [
  analysisBaseInput.extend({
    rangeMode: z.literal("date"),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  analysisBaseInput.extend({
    rangeMode: z.literal("issue"),
    fromIssue: z.string().trim().min(1).max(32),
    toIssue: z.string().trim().min(1).max(32),
  }).strict(),
  analysisBaseInput.extend({
    rangeMode: z.literal("count"),
    count: z.number().int().positive(),
  }).strict(),
]);
const drawInput = z.object({
  lotteryType: lotteryTypeSchema,
  issue: z.string().trim().min(1).max(32),
  drawDateRoc: z.string().trim(),
  numbers: z.array(z.union([z.string(), z.number()])),
  specialNumber: z.union([z.string(), z.number(), z.null()]).optional(),
  status: z.enum(["active", "inactive", "draft"]).default("active"),
});

function normalizeDraw(input: z.infer<typeof drawInput>, createdAt?: string) {
  const now = new Date().toISOString();
  const numbers = validateDrawNumbers(input.lotteryType, input.numbers);
  const specialNumber = validateSpecialNumber(input.lotteryType, input.specialNumber, numbers);
  return {
    id: `${input.lotteryType}:${input.issue}`,
    lotteryType: input.lotteryType,
    issue: input.issue,
    drawDateRoc: input.drawDateRoc,
    drawDateIso: rocDateToIso(input.drawDateRoc),
    numbers,
    specialNumber,
    status: input.status,
    createdAt: createdAt ?? now,
    updatedAt: now,
  } as const;
}

function compareIssue(a: string, b: string) {
  return a.localeCompare(b, "zh-TW", { numeric: true, sensitivity: "base" });
}

export const lotteryRouter = router({
  latestAll: optionalMemberProcedure.query(async ({ ctx }) => {
    const allowed = ctx.member ? resolveAllowedLotteryTypes(ctx.member) : LOTTERY_TYPES;
    const pairs = await Promise.all(
      LOTTERY_TYPES.map(async lotteryType => {
        if (!allowed.includes(lotteryType)) return [lotteryType, null] as const;
        return [lotteryType, (await listDraws({ lotteryType, limit: 1 }))[0] ?? null] as const;
      }),
    );
    return Object.fromEntries(pairs);
  }),

  latest: optionalMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema }))
    .query(async ({ ctx, input }) => {
      if (ctx.member && !canAccessLotteryType(ctx.member, input.lotteryType)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員尚未開放此彩別" });
      }
      return (await listDraws({ lotteryType: input.lotteryType, limit: 1 }))[0] ?? null;
    }),

  history: memberProcedure
    .input(
      z.object({
        lotteryType: lotteryTypeSchema,
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!canAccessLotteryType(ctx.member, input.lotteryType)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員尚未開放此彩別" });
      }
      const limit = ctx.member.role === "admin" || ctx.member.memberLevel === "premium"
        ? input.limit
        : Math.min(input.limit, 10);
      return listDraws({ ...input, limit });
    }),

  analysis: memberProcedure
    .input(analysisInput)
    .query(async ({ ctx, input }) => {
      if (!canAccessLotteryType(ctx.member, input.lotteryType)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員尚未開放此彩別" });
      }
      const permissions = await resolveEffectivePermissions(ctx.member);
      if (!permissions[input.tool]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員尚未開放此分析工具" });
      }

      const allRecords = await listDraws({ lotteryType: input.lotteryType });
      const matched = input.rangeMode === "date"
        ? allRecords.filter(record => {
            const [from, to] = input.fromDate <= input.toDate
              ? [input.fromDate, input.toDate]
              : [input.toDate, input.fromDate];
            return record.drawDateIso >= from && record.drawDateIso <= to;
          })
        : input.rangeMode === "issue"
          ? allRecords.filter(record => {
            const [from, to] = compareIssue(input.fromIssue, input.toIssue) <= 0
              ? [input.fromIssue, input.toIssue]
              : [input.toIssue, input.fromIssue];
            return compareIssue(record.issue, from) >= 0 && compareIssue(record.issue, to) <= 0;
          })
          : allRecords.slice(0, input.count);

      const roleLimit = ctx.member.role === "admin"
        ? null
        : ctx.member.memberLevel === "premium"
          ? 100
          : 30;
      const selected = roleLimit === null ? matched : matched.slice(0, roleLimit);
      const supportsSpecial = input.lotteryType === "lotto649" || input.lotteryType === "markSix";
      const includeSpecial = supportsSpecial && input.includeSpecial;
      const omission = calculateOmissionContext(allRecords, selected, includeSpecial);

      return {
        records: selected.toReversed(),
        roleLimit,
        totalMatched: matched.length,
        truncated: selected.length < matched.length,
        includeSpecial,
        ...omission,
      };
    }),

  adminSearch: adminMemberProcedure
    .input(
      z.object({
        lotteryType: lotteryTypeSchema,
        issue: z.string().trim().optional(),
        date: z.string().trim().optional(),
      }),
    )
    .query(async ({ input }) => {
      const records = await listDraws({ lotteryType: input.lotteryType, includeInactive: true });
      const targetIndex = records.findIndex(
        record => (!input.issue || record.issue.includes(input.issue)) && (!input.date || record.drawDateRoc === input.date),
      );
      if (targetIndex < 0) return { target: null, before: [], after: [] };
      return {
        target: records[targetIndex],
        before: records.slice(Math.max(0, targetIndex - 10), targetIndex),
        after: records.slice(targetIndex + 1, targetIndex + 11),
      };
    }),

  save: adminMemberProcedure.input(drawInput).mutation(async ({ input }) => upsertDraw(normalizeDraw(input))),

  batchSave: adminMemberProcedure
    .input(z.object({ records: z.array(drawInput).min(1).max(1000) }))
    .mutation(async ({ input }) => {
      const records = input.records.map(record => normalizeDraw(record));
      return { imported: await batchUpsertDraws(records) };
    }),

  delete: adminMemberProcedure
    .input(z.object({ lotteryType: lotteryTypeSchema, issue: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      const success = await deleteDraw(input.lotteryType, input.issue);
      if (!success) throw new TRPCError({ code: "NOT_FOUND", message: "找不到指定期數" });
      return { success };
    }),
});
