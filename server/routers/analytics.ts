import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { recordSiteVisit, getSiteAnalytics } from "../db";
import { adminMemberProcedure } from "../procedures";

export const analyticsRouter = router({
  record: publicProcedure
    .input(z.object({
      visitorId: z.string().min(8).max(64),
      path: z.string().trim().min(1).max(255),
      referrerHost: z.string().trim().max(255).nullable(),
      device: z.enum(["desktop", "mobile", "tablet"]),
    }))
    .mutation(async ({ input }) => {
      await recordSiteVisit(input);
      return { success: true } as const;
    }),
  overview: adminMemberProcedure
    .input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
    .query(({ input }) => getSiteAnalytics(input.days)),
});
