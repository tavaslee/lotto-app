import { z } from "zod";
import { PERMISSION_KEYS } from "../../shared/lottery";
import { publicProcedure, router } from "../_core/trpc";
import { adminMemberProcedure, memberProcedure } from "../procedures";
import { getGlobalPermissions, getSiteSettings, setGlobalPermissions, setSiteSettings } from "../services/googleSheets";
import { resolveEffectivePermissions } from "../services/memberAuth";

const permissionShape = Object.fromEntries(PERMISSION_KEYS.map(key => [key, z.boolean()])) as Record<
  (typeof PERMISSION_KEYS)[number],
  z.ZodBoolean
>;
const permissionSchema = z.object(permissionShape);

export const permissionsRouter = router({
  siteSettings: publicProcedure.query(() => getSiteSettings()),
  mine: memberProcedure.query(({ ctx }) => resolveEffectivePermissions(ctx.member)),
  global: adminMemberProcedure.query(() => getGlobalPermissions()),
  updateGlobal: adminMemberProcedure
    .input(z.object({ level: z.enum(["regular", "premium"]), permissions: permissionSchema }))
    .mutation(async ({ input }) => {
      await setGlobalPermissions(input.level, input.permissions);
      return { success: true };
    }),
  updateSiteSettings: adminMemberProcedure
    .input(z.object({ trendAnalysisVisible: z.boolean() }))
    .mutation(async ({ input }) => {
      await setSiteSettings(input);
      return { success: true };
    }),
});
