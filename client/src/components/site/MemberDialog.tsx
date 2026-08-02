import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import type { MemberSession } from "@/types/member";
import { CalendarClock, CheckCircle2, Crown, LogOut, ShieldCheck, UserRoundPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { nextRegisterModeOnDialogChange, type MemberDialogInitialMode } from "./memberDialogMode";

export function MemberDialog({
  open,
  onOpenChange,
  session,
  initialMode = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: MemberSession | undefined;
  initialMode?: MemberDialogInitialMode;
}) {
  const utils = trpc.useUtils();
  const [registerMode, setRegisterMode] = useState(false);
  useEffect(() => {
    setRegisterMode(currentMode => nextRegisterModeOnDialogChange({
      open,
      hasMemberSession: Boolean(session?.user),
      initialMode,
      currentMode,
    }));
  }, [initialMode, open, session?.user]);
  const login = trpc.memberAuth.login.useMutation({
    onSuccess: async result => {
      await utils.memberAuth.me.invalidate();
      toast.success("登入成功", { description: result.syncWarning ?? "歡迎回到財神" });
      onOpenChange(false);
    },
    onError: error => toast.error("無法登入", { description: error.message }),
  });
  const register = trpc.memberAuth.register.useMutation({
    onSuccess: async result => {
      await utils.memberAuth.me.invalidate();
      toast.success("註冊完成", { description: result.syncWarning ?? "一般會員帳號已開通" });
      onOpenChange(false);
    },
    onError: error => toast.error("無法註冊", { description: error.message }),
  });
  const logout = trpc.memberAuth.logout.useMutation({
    onSuccess: async () => {
      await utils.memberAuth.me.invalidate();
      toast.success("已登出");
      onOpenChange(false);
    },
  });
  const memberStatus = session?.user.memberStatus === "active"
    ? {
        label: "帳號正常",
        tone: "bg-emerald-50 text-emerald-700",
        notice: "目前可依會員等級與客製權限使用已開放的查詢及分析工具。",
      }
    : session?.user.memberStatus === "suspended"
      ? {
          label: "帳號停權",
          tone: "bg-red-50 text-red-700",
          notice: "此帳號目前無法使用會員功能；如需恢復，請聯絡平台管理員確認原因。",
        }
      : {
          label: "待審核",
          tone: "bg-amber-50 text-amber-700",
          notice: "會員資料正在等待管理員確認，審核完成前部分查詢與工具會維持鎖定。",
        };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (registerMode) {
      if (password !== String(data.get("passwordConfirm") ?? "")) {
        toast.error("兩次輸入的密碼不一致");
        return;
      }
      register.mutate({
        username: String(data.get("username") ?? ""),
        password,
      });
    } else {
      login.mutate({ identifier: String(data.get("identifier") ?? ""), password });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-md">
        <div className="brand-header px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              {session?.user ? <CheckCircle2 className="size-5 text-amber-300" /> : <UserRoundPlus className="size-5 text-amber-300" />}
              {session?.user ? "會員中心" : registerMode ? "建立財神會員" : "會員登入"}
            </DialogTitle>
            <DialogDescription className="text-red-50/85">
              {session?.user ? "查看會員等級、效期與已開放功能。" : "登入後即可查詢歷史開獎與使用已授權工具。"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {session?.user ? (
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-4 rounded-2xl bg-amber-50 p-4">
              <span className="grid size-12 place-items-center rounded-full bg-amber-400 text-stone-900">
                {session.user.role === "admin" ? <ShieldCheck className="size-6" /> : <Crown className="size-6" />}
              </span>
              <div>
                <p className="font-black text-stone-900">{session.user.name || session.user.username}</p>
                <p className="text-xs font-semibold text-stone-500">
                  {session.user.role === "admin" ? "管理員" : session.user.memberLevel === "premium" ? "付費會員" : "一般會員"}
                  {session.user.useCustomPermissions ? " · 客製權限" : ""}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${memberStatus.tone}`}>
                  {memberStatus.label}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-stone-100 p-3">
                <p className="text-xs text-stone-400">會員帳號</p>
                <p className="mt-1 truncate font-bold text-stone-800">{session.user.username || session.user.email}</p>
              </div>
              <div className="rounded-xl border border-stone-100 p-3">
                <p className="flex items-center gap-1 text-xs text-stone-400"><CalendarClock className="size-3" />會員效期</p>
                <p className="mt-1 font-bold text-stone-800">
                  {session.user.membershipExpiresAt
                    ? new Date(session.user.membershipExpiresAt).toLocaleDateString("zh-TW")
                    : "永久／未設定"}
                </p>
              </div>
            </div>
            <div className={`rounded-xl px-4 py-3 text-xs font-medium leading-5 ${memberStatus.tone}`}>
              {memberStatus.notice}
            </div>
            {session.user.role === "admin" ? (
              <Link href="/admin" className="block" onClick={() => onOpenChange(false)}>
                <Button className="w-full"><ShieldCheck className="size-4" />進入管理後台</Button>
              </Link>
            ) : null}
            <Button variant="outline" className="w-full" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut className="size-4" />登出
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <form key={registerMode ? "register" : "login"} className="space-y-4" onSubmit={handleSubmit}>
              {registerMode ? (
                <div className="space-y-1.5"><Label htmlFor="username">帳號</Label><Input id="username" name="username" required autoComplete="username" /></div>
              ) : (
                <div className="space-y-1.5"><Label htmlFor="identifier">帳號</Label><Input id="identifier" name="identifier" required autoComplete="username" /></div>
              )}
              <div className="space-y-1.5"><Label htmlFor="password">密碼</Label><Input id="password" name="password" type="password" required autoComplete={registerMode ? "new-password" : "current-password"} /></div>
              {registerMode ? (
                <div className="space-y-1.5"><Label htmlFor="passwordConfirm">再次輸入密碼</Label><Input id="passwordConfirm" name="passwordConfirm" type="password" required autoComplete="new-password" /></div>
              ) : null}
              <Button type="submit" className="w-full" disabled={login.isPending || register.isPending}>
                {login.isPending || register.isPending ? "處理中…" : registerMode ? "建立一般會員" : "登入"}
              </Button>
            </form>
            <button type="button" onClick={() => setRegisterMode(mode => !mode)} className="mt-4 w-full text-center text-sm font-bold text-red-700 hover:text-red-800">
              {registerMode ? "已經有帳號？返回登入" : "還沒有帳號？立即註冊"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
