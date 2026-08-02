import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { LOTTERY_TYPES, PERMISSION_KEYS } from "../../shared/lottery";
import { router } from "../_core/trpc";
import { getUserById, listMemberUsers, updateUserById } from "../db";
import { adminMemberProcedure } from "../procedures";
import {
  hashPassword,
  publicMember,
  syncMemberSafely,
} from "../services/memberAuth";

const permissionOverrideShape = Object.fromEntries(
  PERMISSION_KEYS.map(key => [key, z.boolean()]),
) as Record<(typeof PERMISSION_KEYS)[number], z.ZodBoolean>;
const permissionOverridesSchema = z.object(permissionOverrideShape).partial().default({});

export const adminMembersRouter = router({
  list: adminMemberProcedure.query(async () => (await listMemberUsers()).map(publicMember)),

  update: adminMemberProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(320),
        phone: z.string().trim().max(32).default(""),
        role: z.enum(["user", "admin"]),
        memberLevel: z.enum(["regular", "premium"]),
        memberStatus: z.enum(["active", "suspended", "pending"]),
        membershipExpiresAt: z.string().datetime().nullable(),
        useCustomPermissions: z.boolean(),
        customPermissions: permissionOverridesSchema,
        allowedLotteryTypes: z.array(z.enum(LOTTERY_TYPES)).min(1, "付費會員至少需要開放一個彩別").default([...LOTTERY_TYPES]),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await updateUserById(input.id, {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        role: input.role,
        memberLevel: input.memberLevel,
        memberStatus: input.memberStatus,
        membershipExpiresAt: input.membershipExpiresAt ? new Date(input.membershipExpiresAt) : null,
        useCustomPermissions: input.useCustomPermissions,
        customPermissions: input.useCustomPermissions ? input.customPermissions : {},
        allowedLotteryTypes: input.role === "user" && input.memberLevel === "premium"
          ? input.allowedLotteryTypes
          : null,
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "找不到會員" });
      return { user: publicMember(user), syncWarning: await syncMemberSafely(user) };
    }),

  resetPassword: adminMemberProcedure
    .input(z.object({ id: z.number().int().positive(), newPassword: z.string().min(1, "請輸入新密碼") }))
    .mutation(async ({ input }) => {
      const user = await getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "找不到會員" });
      const updated = await updateUserById(user.id, {
        passwordHash: await hashPassword(input.newPassword),
        activeMemberSessionId: null,
      });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "找不到會員" });
      return { success: true, syncWarning: await syncMemberSafely(updated) };
    }),

  retrySync: adminMemberProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const user = await getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "找不到會員" });
      const syncWarning = await syncMemberSafely(user);
      const updated = await getUserById(user.id);
      return { user: updated ? publicMember(updated) : publicMember(user), syncWarning };
    }),
});
