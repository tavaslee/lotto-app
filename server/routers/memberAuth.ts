import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  createLocalUser,
  getUserByUsername,
  getUserByUsernameOrEmail,
  updateUserById,
} from "../db";
import {
  MEMBER_SESSION_COOKIE,
  MEMBER_SESSION_MAX_AGE_MS,
  createMemberSessionId,
  createMemberSessionToken,
  hashPassword,
  publicMember,
  readMemberSession,
  revokeMemberSession,
  resolveEffectivePermissions,
  syncMemberSafely,
  verifyPassword,
} from "../services/memberAuth";

const usernameSchema = z
  .string()
  .trim()
  .min(1, "請輸入帳號")
  .transform(value => value.toLowerCase());

const passwordSchema = z.string().min(1, "請輸入密碼");

export const memberRegistrationSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const memberAuthRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    const user = (await readMemberSession(ctx.req)) ?? (ctx.user?.role === "admin" ? ctx.user : null);
    if (!user) return null;
    return {
      user: publicMember(user),
      permissions: await resolveEffectivePermissions(user),
    };
  }),

  register: publicProcedure
    .input(memberRegistrationSchema)
    .mutation(async ({ ctx, input }) => {
      if (await getUserByUsername(input.username)) {
        throw new TRPCError({ code: "CONFLICT", message: "此會員帳號已被使用" });
      }
      const sessionId = createMemberSessionId();
      const user = await createLocalUser({
        username: input.username,
        passwordHash: await hashPassword(input.password),
        name: input.username,
        email: null,
        phone: null,
        loginMethod: "password",
        memberLevel: "regular",
        memberStatus: "active",
        role: "user",
        activeMemberSessionId: sessionId,
      });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "建立會員失敗" });
      const token = await createMemberSessionToken(user.id, sessionId);
      ctx.res.cookie(MEMBER_SESSION_COOKIE, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: MEMBER_SESSION_MAX_AGE_MS,
      });
      return {
        user: publicMember(user),
        permissions: await resolveEffectivePermissions(user),
        syncWarning: await syncMemberSafely(user),
      };
    }),

  login: publicProcedure
    .input(z.object({ identifier: z.string().trim().min(1), password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByUsernameOrEmail(input.identifier.toLowerCase());
      if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼不正確" });
      }
      if (user.memberStatus !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "此會員帳號目前無法登入" });
      }
      if (user.membershipExpiresAt && user.membershipExpiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "會員效期已到期，請聯絡管理員" });
      }
      const sessionId = user.role === "user" ? createMemberSessionId() : undefined;
      const updated = await updateUserById(user.id, {
        lastSignedIn: new Date(),
        activeMemberSessionId: sessionId ?? null,
      });
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "登入失敗" });
      const token = await createMemberSessionToken(updated.id, sessionId);
      ctx.res.cookie(MEMBER_SESSION_COOKIE, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: MEMBER_SESSION_MAX_AGE_MS,
      });
      return {
        user: publicMember(updated),
        permissions: await resolveEffectivePermissions(updated),
        syncWarning: await syncMemberSafely(updated),
      };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await revokeMemberSession(ctx.req);
    ctx.res.clearCookie(MEMBER_SESSION_COOKIE, {
      ...getSessionCookieOptions(ctx.req),
      maxAge: -1,
    });
    return { success: true } as const;
  }),
});
