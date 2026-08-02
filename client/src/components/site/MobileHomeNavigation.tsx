import { ContactDialog } from "@/components/site/ContactDialog";
import type { MemberSession } from "@/types/member";
import { LOTTERY_CONFIG, LOTTERY_TYPES, type LotteryType } from "@shared/lottery";
import { MessageCircle } from "lucide-react";
import React, { useState } from "react";

export function MobileHomeNavigation({
  selectedLottery,
  session,
  onSelectLottery,
}: {
  selectedLottery: LotteryType;
  session: MemberSession | undefined;
  onSelectLottery: (lotteryType: LotteryType) => void;
}) {
  const [contactOpen, setContactOpen] = useState(false);
  const isLotteryAllowed = (type: LotteryType) => session?.user.role === "admin"
    || session?.user.memberLevel !== "premium"
    || session.user.allowedLotteryTypes.includes(type);

  return (
    <section aria-label="手機與平板主選單">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {LOTTERY_TYPES.map(type => (
          <button
            key={type}
            type="button"
            disabled={!isLotteryAllowed(type)}
            onClick={() => onSelectLottery(type)}
            title={isLotteryAllowed(type) ? undefined : "此會員尚未開放此彩別"}
            className={`min-h-14 rounded-2xl px-1.5 py-3 text-[15px] font-black leading-tight shadow-sm ring-1 transition-transform active:scale-[.97] sm:min-h-16 sm:text-lg ${
              selectedLottery === type
                ? "bg-red-600 text-white ring-red-600"
                : "bg-white text-stone-800 ring-stone-200"
            } disabled:cursor-not-allowed disabled:opacity-35`}
          >
            {LOTTERY_CONFIG[type].name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="flex min-h-14 items-center justify-center gap-1 rounded-2xl bg-emerald-600 px-1.5 py-3 text-[15px] font-black leading-tight text-white shadow-sm ring-1 ring-emerald-600 transition-transform active:scale-[.97] sm:min-h-16 sm:text-lg"
        >
          <MessageCircle className="size-4 shrink-0 sm:size-5" />與我們聯絡
        </button>
      </div>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </section>
  );
}
