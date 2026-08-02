import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import type { MemberSession } from "@/types/member";
import {
  LOTTERY_CONFIG,
  LOTTERY_TYPES,
  MANAGEABLE_PERMISSION_KEYS,
  PERMISSION_LABELS,
  type LotteryType,
  type MemberLevel,
  type PermissionOverrides,
  type PermissionSet,
} from "@shared/lottery";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Crown,
  Eye,
  KeyRound,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type MemberItem = NonNullable<MemberSession>["user"];

const statusLabel = { active: "正常", suspended: "停權", pending: "待審核" } as const;
const levelLabel = { regular: "一般會員", premium: "付費會員" } as const;

function SyncBadge({ member }: { member: MemberItem }) {
  const config = member.memberSyncStatus === "synced"
    ? { label: "已同步", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 }
    : member.memberSyncStatus === "failed"
      ? { label: "同步失敗", className: "bg-red-50 text-red-700", icon: AlertTriangle }
      : { label: "待同步", className: "bg-amber-50 text-amber-700", icon: Clock3 };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${config.className}`}>
      <Icon className="size-3.5" />{config.label}
    </span>
  );
}

export function MemberManagement() {
  const utils = trpc.useUtils();
  const membersQuery = trpc.adminMembers.list.useQuery();
  const globalQuery = trpc.permissions.global.useQuery();
  const siteSettingsQuery = trpc.permissions.siteSettings.useQuery();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MemberItem | null>(null);
  const [customPermissions, setCustomPermissions] = useState<PermissionOverrides>({});
  const [allowedLotteryTypes, setAllowedLotteryTypes] = useState<LotteryType[]>([...LOTTERY_TYPES]);
  const [memberLevelDraft, setMemberLevelDraft] = useState<MemberLevel>("regular");
  const [roleDraft, setRoleDraft] = useState<"user" | "admin">("user");
  const [globalDraft, setGlobalDraft] = useState<Record<MemberLevel, PermissionSet> | null>(null);
  const [trendAnalysisVisible, setTrendAnalysisVisible] = useState(true);

  useEffect(() => {
    if (globalQuery.data) setGlobalDraft(structuredClone(globalQuery.data));
  }, [globalQuery.data]);

  useEffect(() => {
    if (siteSettingsQuery.data) setTrendAnalysisVisible(siteSettingsQuery.data.trendAnalysisVisible);
  }, [siteSettingsQuery.data]);

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (membersQuery.data ?? []).filter(member =>
      !keyword || [member.username, member.name, member.email].some(value => value?.toLowerCase().includes(keyword)),
    );
  }, [membersQuery.data, query]);

  const updateMember = trpc.adminMembers.update.useMutation({
    onSuccess: async result => {
      toast.success("會員資料已更新", {
        description: result.syncWarning ?? "Google Sheets 備份同步完成",
      });
      setSelected(null);
      await utils.adminMembers.list.invalidate();
    },
    onError: error => toast.error("更新失敗", { description: error.message }),
  });
  const resetPassword = trpc.adminMembers.resetPassword.useMutation({
    onSuccess: async result => {
      toast.success("會員密碼已安全重設", {
        description: result.syncWarning ?? "會員備份狀態已更新",
      });
      await utils.adminMembers.list.invalidate();
    },
    onError: error => toast.error("密碼重設失敗", { description: error.message }),
  });
  const retrySync = trpc.adminMembers.retrySync.useMutation({
    onSuccess: async result => {
      if (result.syncWarning) toast.error("同步仍未成功", { description: result.syncWarning });
      else toast.success("會員資料已重新同步至 Google Sheets");
      setSelected(result.user);
      await utils.adminMembers.list.invalidate();
    },
    onError: error => toast.error("重試同步失敗", { description: error.message }),
  });
  const updateGlobal = trpc.permissions.updateGlobal.useMutation({
    onSuccess: async () => {
      toast.success("群組權限已寫入 Google Sheets");
      await globalQuery.refetch();
    },
    onError: error => toast.error("權限更新失敗", { description: error.message }),
  });
  const updateSiteSettings = trpc.permissions.updateSiteSettings.useMutation({
    onSuccess: async () => {
      toast.success("前台走勢分析顯示設定已更新");
      await utils.permissions.siteSettings.invalidate();
    },
    onError: error => toast.error("顯示設定更新失敗", { description: error.message }),
  });

  const editMember = (member: MemberItem) => {
    setSelected(member);
    setCustomPermissions(member.customPermissions ?? {});
    setAllowedLotteryTypes(member.allowedLotteryTypes?.length ? member.allowedLotteryTypes : [...LOTTERY_TYPES]);
    setMemberLevelDraft(member.memberLevel);
    setRoleDraft(member.role);
  };

  const submitMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const expires = String(data.get("membershipExpiresAt") ?? "");
    if (roleDraft === "user" && memberLevelDraft === "premium" && allowedLotteryTypes.length === 0) {
      toast.error("請至少勾選一個彩別");
      return;
    }
    updateMember.mutate({
      id: selected.id,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      role: roleDraft,
      memberLevel: memberLevelDraft,
      memberStatus: String(data.get("memberStatus")) as "active" | "suspended" | "pending",
      membershipExpiresAt: expires ? new Date(`${expires}T23:59:59+08:00`).toISOString() : null,
      useCustomPermissions: data.get("useCustomPermissions") === "on",
      customPermissions,
      allowedLotteryTypes,
    });
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const password = String(new FormData(event.currentTarget).get("newPassword") ?? "");
    resetPassword.mutate({ id: selected.id, newPassword: password });
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">MEMBERS & ACCESS</p>
        <h2 className="mt-1 text-2xl font-black text-stone-950">會員與權限矩陣</h2>
        <p className="mt-2 text-sm text-stone-500">本地資料庫負責登入驗證，會員摘要與全域權限同步備份到 Google Sheets。</p>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-black text-stone-900"><UsersRound className="size-5 text-red-600" />會員名冊</h3>
            <p className="mt-1 text-xs text-stone-400">共 {membersQuery.data?.length ?? 0} 位會員</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input value={query} onChange={event => setQuery(event.target.value)} className="pl-9" placeholder="搜尋帳號、姓名、Email" />
          </div>
        </div>
        {membersQuery.isError ? (
          <div className="p-8 text-center text-sm font-semibold text-red-600">會員讀取失敗：{membersQuery.error.message}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-400">
                <tr><th className="px-5 py-3">會員</th><th className="px-4 py-3">等級</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3">效期</th><th className="px-4 py-3">備份同步</th><th className="px-4 py-3">權限</th><th className="px-5 py-3 text-right">操作</th></tr>
              </thead>
              <tbody className="divide-y">
                {filteredMembers.map(member => (
                  <tr key={member.id} className="hover:bg-orange-50/50">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-full ${member.role === "admin" ? "bg-red-100 text-red-700" : member.memberLevel === "premium" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{member.role === "admin" ? <ShieldCheck className="size-4" /> : <Crown className="size-4" />}</span><div><p className="font-bold text-stone-900">{member.name || member.username || "未命名會員"}</p><p className="text-xs text-stone-400">{member.username || member.email}</p></div></div></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.memberLevel === "premium" ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"}`}>{levelLabel[member.memberLevel]}</span></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.memberStatus === "active" ? "bg-emerald-50 text-emerald-700" : member.memberStatus === "suspended" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>{statusLabel[member.memberStatus]}</span></td>
                    <td className="px-4 py-4 text-xs font-semibold text-stone-500">{member.membershipExpiresAt ? new Date(member.membershipExpiresAt).toLocaleDateString("zh-TW") : "未設定"}</td>
                    <td className="px-4 py-4"><SyncBadge member={member} /><p className="mt-1 text-[10px] text-stone-400">{member.memberSyncedAt ? new Date(member.memberSyncedAt).toLocaleString("zh-TW") : "尚無成功紀錄"}</p></td>
                    <td className="px-4 py-4 text-xs font-semibold text-stone-500"><p>{member.useCustomPermissions ? "個別客製" : "群組預設"}</p>{member.role === "user" && member.memberLevel === "premium" ? <p className="mt-1 text-[10px] text-amber-700">{member.allowedLotteryTypes.map(type => LOTTERY_CONFIG[type].name).join("、")}</p> : null}</td>
                    <td className="px-5 py-4 text-right"><Button size="sm" variant="outline" onClick={() => editMember(member)}><Pencil className="size-3.5" />編輯</Button></td>
                  </tr>
                ))}
                {!filteredMembers.length ? <tr><td colSpan={7} className="p-10 text-center text-sm font-semibold text-stone-400">找不到符合條件的會員</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><Eye className="size-5" /></span><div><h3 className="font-black text-stone-900">前台分析工具顯示</h3><p className="mt-1 text-xs leading-5 text-stone-400">控制前台側邊欄是否顯示「走勢分析」及其分析項目。</p></div></div>
          <div className="flex items-center gap-3"><label className="flex items-center gap-2 rounded-xl border bg-stone-50 px-4 py-2.5 text-sm font-bold text-stone-700"><Checkbox checked={trendAnalysisVisible} onCheckedChange={checked => setTrendAnalysisVisible(Boolean(checked))} />顯示走勢分析</label><Button onClick={() => updateSiteSettings.mutate({ trendAnalysisVisible })} disabled={siteSettingsQuery.isLoading || updateSiteSettings.isPending}><Save className="size-4" />儲存</Button></div>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><UserCog className="size-5" /></span><div><h3 className="font-black text-stone-900">群組全域權限</h3><p className="mt-1 text-xs text-stone-400">一般與付費會員各 7 項前台功能；個別會員可在上方名冊覆寫。</p></div></div>
        {globalQuery.isError ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-600">權限讀取失敗：{globalQuery.error.message}</p>
        ) : globalDraft ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {(["regular", "premium"] as const).map(level => (
              <div key={level} className="overflow-hidden rounded-2xl border">
                <div className={`flex items-center justify-between px-4 py-3 ${level === "premium" ? "bg-amber-50" : "bg-stone-50"}`}><div><p className="font-black text-stone-900">{levelLabel[level]}</p><p className="text-[11px] font-semibold text-stone-400">Google Sheets 全域設定</p></div><Button size="sm" onClick={() => updateGlobal.mutate({ level, permissions: globalDraft[level] })} disabled={updateGlobal.isPending}><Save className="size-3.5" />儲存</Button></div>
                <div className="grid grid-cols-2 gap-px bg-stone-100 p-px">{MANAGEABLE_PERMISSION_KEYS.map(key => <label key={key} className="flex items-center gap-2 bg-white px-3 py-3 text-xs font-semibold text-stone-700"><Checkbox checked={globalDraft[level][key]} onCheckedChange={checked => setGlobalDraft(current => current ? { ...current, [level]: { ...current[level], [key]: Boolean(checked) } } : current)} />{PERMISSION_LABELS[key]}</label>)}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm font-semibold text-stone-400">讀取權限矩陣中…</p>}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>會員資料與個別權限</DialogTitle><DialogDescription>修改會員等級、效期、登入狀態與 7 項前台功能覆寫設定。</DialogDescription></DialogHeader>
          {selected ? (
            <div className="space-y-6">
              <div className={`rounded-2xl border p-4 ${selected.memberSyncStatus === "failed" ? "border-red-200 bg-red-50" : "bg-stone-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-stone-400">GOOGLE SHEETS 備份</p><div className="mt-2"><SyncBadge member={selected} /></div></div><Button type="button" size="sm" variant="outline" disabled={retrySync.isPending} onClick={() => retrySync.mutate({ id: selected.id })}><RefreshCw className={`size-3.5 ${retrySync.isPending ? "animate-spin" : ""}`} />重新同步</Button></div>
                <p className="mt-3 text-xs leading-5 text-stone-500">最後成功：{selected.memberSyncedAt ? new Date(selected.memberSyncedAt).toLocaleString("zh-TW") : "尚無成功紀錄"}</p>
                {selected.memberSyncError ? <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs font-semibold text-red-700">錯誤原因：{selected.memberSyncError}</p> : null}
              </div>
              <form onSubmit={submitMember} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>姓名</Label><Input name="name" required defaultValue={selected.name ?? ""} /></div>
                  <div className="space-y-1.5"><Label>電子郵件</Label><Input name="email" type="email" required defaultValue={selected.email ?? ""} /></div>
                  <div className="space-y-1.5"><Label>手機</Label><Input name="phone" defaultValue={selected.phone ?? ""} /></div>
                  <div className="space-y-1.5"><Label>到期日期</Label><Input name="membershipExpiresAt" type="date" defaultValue={selected.membershipExpiresAt ? new Date(selected.membershipExpiresAt).toISOString().slice(0, 10) : ""} /></div>
                  <div className="space-y-1.5"><Label>會員等級</Label><select name="memberLevel" value={memberLevelDraft} onChange={event => setMemberLevelDraft(event.target.value as MemberLevel)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="regular">一般會員</option><option value="premium">付費會員</option></select></div>
                  <div className="space-y-1.5"><Label>帳號狀態</Label><select name="memberStatus" defaultValue={selected.memberStatus} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="active">正常</option><option value="pending">待審核</option><option value="suspended">停權</option></select></div>
                  <div className="space-y-1.5"><Label>系統角色</Label><select name="role" value={roleDraft} onChange={event => setRoleDraft(event.target.value as "user" | "admin")} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="user">一般使用者</option><option value="admin">管理員</option></select></div>
                </div>
                {roleDraft === "user" && memberLevelDraft === "premium" ? (
                  <fieldset className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <legend className="px-1 text-sm font-black text-amber-900">可使用彩別（可多選）</legend>
                    <p className="mb-3 text-xs text-amber-800/75">未勾選的彩別將不會出現在此會員的前台彩別選單，伺服器也會拒絕其歷史與版路查詢。</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {LOTTERY_TYPES.map(type => (
                        <label key={type} className="flex items-center gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-xs font-bold text-stone-700">
                          <Checkbox
                            checked={allowedLotteryTypes.includes(type)}
                            onCheckedChange={checked => setAllowedLotteryTypes(current => checked ? [...current, type] : current.filter(item => item !== type))}
                          />
                          {LOTTERY_CONFIG[type].name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <label className="flex items-center gap-3 rounded-xl border bg-stone-50 p-4 text-sm font-bold text-stone-700"><Checkbox name="useCustomPermissions" defaultChecked={selected.useCustomPermissions} />啟用此會員的個別客製權限</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{MANAGEABLE_PERMISSION_KEYS.map(key => <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold"><Checkbox checked={Boolean(customPermissions[key])} onCheckedChange={checked => setCustomPermissions(current => ({ ...current, [key]: Boolean(checked) }))} />{PERMISSION_LABELS[key]}</label>)}</div>
                <Button type="submit" disabled={updateMember.isPending}><Save className="size-4" />{updateMember.isPending ? "更新中…" : "儲存會員設定"}</Button>
              </form>
              <form onSubmit={submitPassword} className="rounded-2xl border border-red-100 bg-red-50/60 p-4"><div className="mb-3 flex items-center gap-2"><KeyRound className="size-4 text-red-600" /><p className="text-sm font-black text-red-900">密碼維護</p></div><div className="flex flex-col gap-2 sm:flex-row"><Input name="newPassword" type="password" required placeholder="輸入新密碼" /><Button type="submit" variant="destructive" disabled={resetPassword.isPending}>重設密碼</Button></div></form>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
