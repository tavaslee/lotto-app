import { Button } from "@/components/ui/button";
import type { MemberSession } from "@/types/member";
import {
  BarChart3,
  ChevronLeft,
  DatabaseZap,
  ImageIcon,
  LogOut,
  Menu,
  ShieldCheck,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { Link } from "wouter";

export type AdminSection = "overview" | "draws" | "images" | "members";
export type SheetsStatus = "loading" | "healthy" | "error";

const sections: Array<{ key: AdminSection; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "管理總覽", icon: BarChart3 },
  { key: "draws", label: "開獎號碼維護", icon: TicketCheck },
  { key: "images", label: "版路多圖管理", icon: ImageIcon },
  { key: "members", label: "會員與權限", icon: UsersRound },
];

export function AdminShell({
  session,
  section,
  onSectionChange,
  onLogout,
  sheetsStatus,
  children,
}: {
  session: NonNullable<MemberSession>;
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onLogout: () => void;
  sheetsStatus: SheetsStatus;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(
    () => new URLSearchParams(window.location.search).get("nav") === "open",
  );
  const statusText = sheetsStatus === "healthy" ? "已連線" : sheetsStatus === "error" ? "連線異常" : "確認中";

  const closeMobileNavigation = () => {
    setMobileOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("nav")) {
      url.searchParams.delete("nav");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  };

  const navigate = (next: AdminSection) => {
    onSectionChange(next);
    closeMobileNavigation();
  };

  const navigation = (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/" className="flex items-center gap-3 text-white">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10">
            <ShieldCheck className="size-5 text-amber-300" />
          </span>
          <span>
            <strong className="block text-lg font-black tracking-wider">財神後台</strong>
            <small className="text-[10px] font-semibold tracking-[0.16em] text-stone-400">ADMIN CONSOLE</small>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="管理功能">
        {sections.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition-colors ${
                section === item.key
                  ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-950/20"
                  : "text-stone-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-4.5" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-xl bg-white/5 p-3">
          <p className="truncate text-sm font-bold text-white">{session.user.name || session.user.email}</p>
          <p className={`mt-0.5 text-[11px] font-semibold ${sheetsStatus === "error" ? "text-red-300" : "text-amber-300"}`}>
            管理員身分已驗證 · Sheets {statusText}
          </p>
        </div>
        <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-stone-400 hover:bg-white/5 hover:text-white">
          <LogOut className="size-4" />登出
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-stone-950 lg:flex">{navigation}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden" onClick={closeMobileNavigation}>
          <aside className="flex h-full w-[min(82vw,280px)] flex-col bg-stone-950" onClick={event => event.stopPropagation()}>{navigation}</aside>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-lg bg-stone-100 lg:hidden" aria-label="開啟管理選單"><Menu className="size-5" /></button>
            <div>
              <p className="text-[10px] font-bold text-red-600 sm:text-xs">
                管理員身分已驗證 · {session.user.name || session.user.email}
              </p>
              <h1 className="text-base font-black text-stone-900">{sections.find(item => item.key === section)?.label}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${
              sheetsStatus === "healthy" ? "bg-emerald-50 text-emerald-700" : sheetsStatus === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
            }`}>
              <DatabaseZap className="size-3.5" />
              {sheetsStatus === "healthy" ? "Sheets API 正常" : sheetsStatus === "error" ? "Sheets API 異常" : "Sheets API 確認中"}
            </span>
            <Link href="/"><Button variant="outline" size="sm"><ChevronLeft className="size-4" />返回前台</Button></Link>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
