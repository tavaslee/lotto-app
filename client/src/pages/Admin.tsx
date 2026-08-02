import { AdminShell, type AdminSection, type SheetsStatus } from "@/components/admin/AdminShell";
import { DrawManagement } from "@/components/admin/DrawManagement";
import { ImageManagement } from "@/components/admin/ImageManagement";
import { MemberManagement } from "@/components/admin/MemberManagement";
import { TrafficDashboard } from "@/components/admin/TrafficDashboard";
import { MemberDialog } from "@/components/site/MemberDialog";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { LockKeyhole, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

function AccessGate({ forbidden = false }: { forbidden?: boolean }) {
  const [memberOpen, setMemberOpen] = useState(false);
  const [forceLogin, setForceLogin] = useState(false);
  const [switching, setSwitching] = useState(false);
  const sessionQuery = trpc.memberAuth.me.useQuery();
  const memberLogout = trpc.memberAuth.logout.useMutation();
  const oauthLogout = trpc.auth.logout.useMutation();
  const utils = trpc.useUtils();

  const clearCurrentSession = async () => {
    setSwitching(true);
    await Promise.allSettled([memberLogout.mutateAsync(), oauthLogout.mutateAsync()]);
    await utils.memberAuth.me.invalidate();
    setForceLogin(true);
    setSwitching(false);
  };

  const switchToPasswordAdmin = async () => {
    await clearCurrentSession();
    setMemberOpen(true);
  };

  const switchToOwner = async () => {
    await clearCurrentSession();
    startLogin();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-stone-950 p-5">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="brand-header p-7 text-white">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
            {forbidden ? <ShieldAlert className="size-6 text-amber-300" /> : <ShieldCheck className="size-6 text-amber-300" />}
          </span>
          <h1 className="mt-5 text-2xl font-black">{forbidden ? "管理權限不足" : "管理員登入"}</h1>
          <p className="mt-2 text-sm leading-6 text-red-50/85">{forbidden ? "目前登入的是一般會員；請先登出此帳號，再改用管理員帳密或網站擁有者身分登入。" : "可使用後台管理員帳密，或以網站擁有者身分登入。"}</p>
        </div>
        <div className="space-y-3 p-6">
          {forbidden && sessionQuery.data?.user ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
              目前帳號：{sessionQuery.data.user.name || sessionQuery.data.user.username || sessionQuery.data.user.email}
            </div>
          ) : null}
          <Button className="w-full" disabled={switching} onClick={forbidden ? switchToPasswordAdmin : () => setMemberOpen(true)}>
            {forbidden ? <LogOut className="size-4" /> : <LockKeyhole className="size-4" />}
            {switching ? "正在切換帳號…" : forbidden ? "登出並以管理員帳密登入" : "使用管理員帳密登入"}
          </Button>
          <Button variant="outline" className="w-full" disabled={switching} onClick={forbidden ? switchToOwner : () => startLogin()}>
            <ShieldCheck className="size-4" />{forbidden ? "登出並以網站擁有者登入" : "網站擁有者登入"}
          </Button>
          <Link href="/"><Button variant="ghost" className="w-full">返回前台</Button></Link>
        </div>
      </div>
      <MemberDialog open={memberOpen} onOpenChange={setMemberOpen} session={forceLogin ? null : sessionQuery.data} initialMode="login" />
    </div>
  );
}

function AdminOverview({ sheetsStatus }: { sheetsStatus: SheetsStatus }) {
  const members = trpc.adminMembers.list.useQuery();
  const images = trpc.trendImages.adminList.useQuery({});
  const cards = [
    { label: "會員總數", value: members.data?.length ?? 0, detail: "本地驗證資料庫" },
    { label: "付費會員", value: members.data?.filter(member => member.memberLevel === "premium").length ?? 0, detail: "含未到期會員" },
    { label: "版路圖片", value: images.data?.length ?? 0, detail: "S3 與外部網址" },
    { label: "資料來源", value: "4", detail: "Google 工作表" },
  ];
  const heading = sheetsStatus === "healthy" ? "雙層資料保護已啟用" : sheetsStatus === "error" ? "Google Sheets 同步連線異常" : "正在確認 Google Sheets 連線";
  const description = sheetsStatus === "error"
    ? "本地會員驗證仍可運作，但開獎、圖片、權限與會員備份暫時無法同步；請檢查服務帳戶權限或稍後重試。"
    : "開獎、版路、會員備份與權限設定寫入 Google Sheets；帳密雜湊、登入驗證與即時權限查詢使用本地資料庫。";
  return (
    <div className="space-y-6">
      <div><p className="eyebrow">SYSTEM STATUS</p><h2 className="mt-1 text-2xl font-black text-stone-950">管理總覽</h2><p className="mt-2 text-sm text-stone-500">整合網站真實流量、會員、圖片與 Google Sheets 同步狀態。</p></div>
      <TrafficDashboard />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <article key={card.label} className="surface-card p-5"><p className="text-xs font-bold text-stone-400">{card.label}</p><p className="mt-2 text-3xl font-black text-stone-950">{card.value}</p><p className="mt-2 text-xs font-semibold text-stone-400">{card.detail}</p></article>)}</div>
      <div className={`surface-card p-6 ${sheetsStatus === "error" ? "border-red-200" : ""}`}><div className="flex items-start gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${sheetsStatus === "healthy" ? "bg-emerald-50 text-emerald-600" : sheetsStatus === "error" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><ShieldCheck className="size-5" /></span><div><h3 className="font-black text-stone-900">{heading}</h3><p className="mt-1 text-sm leading-6 text-stone-500">{description}</p></div></div></div>
    </div>
  );
}

export default function Admin() {
  const [section, setSection] = useState<AdminSection>(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    return requested === "draws" || requested === "images" || requested === "members"
      ? requested
      : "overview";
  });
  const sessionQuery = trpc.memberAuth.me.useQuery();
  const utils = trpc.useUtils();
  const memberLogout = trpc.memberAuth.logout.useMutation();
  const oauthLogout = trpc.auth.logout.useMutation();
  const isAdmin = sessionQuery.data?.user.role === "admin";
  const sheetsHealth = trpc.integrations.googleSheetsHealth.useQuery(undefined, {
    enabled: isAdmin,
    retry: 1,
    refetchInterval: 5 * 60 * 1000,
  });

  if (sessionQuery.isLoading) return <div className="grid min-h-screen place-items-center bg-stone-950 text-sm font-bold text-stone-400">正在驗證管理員身分…</div>;
  if (!sessionQuery.data?.user) return <AccessGate />;
  if (sessionQuery.data.user.role !== "admin") return <AccessGate forbidden />;

  const logout = async () => {
    await Promise.allSettled([memberLogout.mutateAsync(), oauthLogout.mutateAsync()]);
    await utils.memberAuth.me.invalidate();
    window.location.href = "/";
  };
  const changeSection = (next: AdminSection) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };
  const sheetsStatus: SheetsStatus = sheetsHealth.isLoading ? "loading" : sheetsHealth.isError ? "error" : "healthy";

  return (
    <AdminShell session={sessionQuery.data} section={section} onSectionChange={changeSection} onLogout={logout} sheetsStatus={sheetsStatus}>
      {section === "overview" ? <AdminOverview sheetsStatus={sheetsStatus} /> : section === "draws" ? <DrawManagement /> : section === "images" ? <ImageManagement /> : <MemberManagement />}
    </AdminShell>
  );
}
