import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { adminMembersRouter } from "./routers/adminMembers";
import { analyticsRouter } from "./routers/analytics";
import { carouselRouter } from "./routers/carousel";
import { integrationsRouter } from "./routers/integrations";
import { lotteryRouter } from "./routers/lottery";
import { memberAuthRouter } from "./routers/memberAuth";
import { permissionsRouter } from "./routers/permissions";
import { trendImagesRouter } from "./routers/trendImages";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  memberAuth: memberAuthRouter,
  lottery: lotteryRouter,
  trendImages: trendImagesRouter,
  permissions: permissionsRouter,
  adminMembers: adminMembersRouter,
  carousel: carouselRouter,
  integrations: integrationsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
