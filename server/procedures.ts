import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./_core/trpc";
import { readMemberSession } from "./services/memberAuth";

export const memberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const member = (await readMemberSession(ctx.req)) ?? (ctx.user?.role === "admin" ? ctx.user : null);
  if (!member) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入會員帳號" });
  }
  return next({ ctx: { ...ctx, member } });
});

export const optionalMemberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const member = (await readMemberSession(ctx.req)) ?? (ctx.user?.role === "admin" ? ctx.user : null);
  return next({ ctx: { ...ctx, member } });
});

export const adminMemberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const member = (await readMemberSession(ctx.req)) ?? (ctx.user?.role === "admin" ? ctx.user : null);
  if (!member) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入管理員帳號" });
  }
  if (member.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "此功能僅限管理員使用" });
  }
  return next({ ctx: { ...ctx, member } });
});
