import { Button } from "@/components/ui/button";
import type { MemberSession } from "@/types/member";
import { LOTTERY_CONFIG, LOTTERY_TYPES, type LotteryType } from "@shared/lottery";
import { MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import React from "react";
import { Link } from "wouter";

function GoldIngotIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.3 13.4c.7-5 3.2-8.2 7.7-8.2s7 3.2 7.7 8.2c-2.3 1.8-4.9 2.7-7.7 2.7s-5.4-.9-7.7-2.7Z"
        fill="currentColor"
      />
      <path
        d="M3.5 14.2c1.8 1.7 4.1 2.8 6.7 3.4 1.7.4 3.7.6 5.8.6s4.1-.2 5.8-.6c2.6-.6 4.9-1.7 6.7-3.4-.4 7.8-4.8 12.6-12.5 12.6S3.9 22 3.5 14.2Z"
        fill="currentColor"
      />
      <path
        d="M10.2 17.6c.7 3.9 2.7 6 5.8 6s5.1-2.1 5.8-6c-1.7.4-3.7.6-5.8.6s-4.1-.2-5.8-.6Z"
        fill="white"
        fillOpacity=".28"
      />
      <path
        d="M13 10.6c.5-1.8 1.5-2.8 3-2.8 1.6 0 2.6 1 3 2.8-1 .6-2 .9-3 .9s-2-.3-3-.9Z"
        fill="white"
        fillOpacity=".52"
      />
    </svg>
  );
}

export function SiteHeader({
  selectedLottery,
  onSelectLottery,
  onHome,
  session,
  onOpenMember,
  onOpenContact,
  compactLayout,
}: {
  selectedLottery: LotteryType;
  onSelectLottery: (lotteryType: LotteryType) => void;
  onHome: () => void;
  session: MemberSession | undefined;
  onOpenMember: () => void;
  onOpenContact: () => void;
  compactLayout: boolean;
}) {
  const badge = session?.user.role === "admin"
    ? "管理員"
    : session?.user.memberLevel === "premium"
      ? "付費會員"
      : session?.user
        ? "一般會員"
        : "訪客";
  const isLotteryAllowed = (type: LotteryType) => session?.user.role === "admin"
    || session?.user.memberLevel !== "premium"
    || session.user.allowedLotteryTypes.includes(type);

  return (
    <header className="brand-header sticky top-0 z-40 text-white shadow-[0_12px_34px_rgba(173,45,20,.2)]">
      <div className="container flex h-[72px] items-center justify-between gap-3">
        <button
          type="button"
          onClick={onHome}
          className="group flex items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="回到財神首頁"
        >
          <span className="grid size-11 place-items-center rounded-[14px] bg-white/15 shadow-inner ring-1 ring-white/25 backdrop-blur-sm transition-transform group-active:scale-95">
            <GoldIngotIcon className="size-8 text-amber-300 drop-shadow-[0_2px_2px_rgba(120,53,15,.35)]" />
          </span>
          <span>
            <span className="block text-[22px] font-black tracking-[0.16em]">財神</span>
            <span className="hidden text-[10px] font-semibold tracking-[0.22em] text-amber-100/90 sm:block">LOTTERY INSIGHT</span>
          </span>
        </button>

        {!compactLayout ? <nav className="flex items-center gap-1" aria-label="主選單">
          {LOTTERY_TYPES.map(type => (
            <button
              key={type}
              type="button"
              disabled={!isLotteryAllowed(type)}
              onClick={() => onSelectLottery(type)}
              title={isLotteryAllowed(type) ? undefined : "此會員尚未開放此彩別"}
              className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                selectedLottery === type
                  ? "bg-white text-red-700 shadow-sm"
                  : "text-white/90 hover:bg-white/15 hover:text-white"
              }`}
            >
              {LOTTERY_CONFIG[type].name}
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-white/25" />
          <button
            type="button"
            onClick={onOpenContact}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-100/70 bg-emerald-600 px-3 py-2 text-sm font-black text-white shadow-[0_5px_14px_rgba(5,150,105,.28)] transition-[background-color,transform,box-shadow] hover:bg-emerald-500 hover:shadow-[0_6px_18px_rgba(5,150,105,.38)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <MessageCircle className="size-4" />與我們聯絡
          </button>
        </nav> : null}

          <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-black/15 px-3 py-1.5 text-xs font-semibold backdrop-blur md:inline-flex">
            {session?.user.useCustomPermissions ? "客製權限 · " : ""}{badge}
          </span>
          {session?.user.role === "admin" ? (
            <Link href="/admin" className="hidden sm:block">
              <Button variant="secondary" size="sm" className="border-0 bg-white/15 text-white hover:bg-white/25">
                <ShieldCheck className="size-4" /> 後台
              </Button>
            </Link>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onOpenMember}
            className="border-0 bg-white/15 text-white hover:bg-white/25"
          >
            <UserRound className="size-5 sm:size-4" />
            <span className="hidden sm:inline">{session?.user ? session.user.name || session.user.username : "會員中心"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
