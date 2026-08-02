import { cn } from "@/lib/utils";
import { LOTTERY_CONFIG, type LotteryType } from "@shared/lottery";

export const LOTTERY_BALL_BASE_CLASS =
  "lottery-ball relative grid shrink-0 place-items-center overflow-hidden rounded-full font-black shadow-sm";

export function getLotteryBallSizeClass(compact: boolean, latest: boolean) {
  if (compact) return "size-7 text-xs";
  if (latest) return "size-9 text-lg sm:size-10 sm:text-lg";
  return "size-11 text-base sm:size-12 sm:text-lg";
}

export function getLotteryBallLayoutClass(latest: boolean, hasSpecialNumber: boolean) {
  return latest && hasSpecialNumber
    ? "flex flex-nowrap items-center gap-1 xl:grid xl:grid-cols-6 xl:gap-2"
    : "flex flex-wrap items-center gap-2";
}

export function LotteryBalls({
  lotteryType,
  numbers,
  specialNumber,
  compact = false,
  latest = false,
}: {
  lotteryType: LotteryType;
  numbers: string[];
  specialNumber?: string | null;
  compact?: boolean;
  latest?: boolean;
}) {
  const { accent, accentForeground } = LOTTERY_CONFIG[lotteryType];
  const latestWithSpecialNumber = latest && Boolean(specialNumber);
  const ballSizeClass = getLotteryBallSizeClass(compact, latest);
  return (
    <div
      className={getLotteryBallLayoutClass(latest, Boolean(specialNumber))}
      aria-label={`開獎號碼 ${numbers.join("、")}${specialNumber ? `，特別號 ${specialNumber}` : ""}`}
    >
      {numbers.map((number, index) => (
        <span
          key={`${number}-${index}`}
          className={cn(LOTTERY_BALL_BASE_CLASS, ballSizeClass)}
          style={{ backgroundColor: accent, color: accentForeground }}
        >
          {number}
        </span>
      ))}
      {specialNumber ? (
        <div className={cn("flex items-center gap-1", latestWithSpecialNumber && "xl:col-span-6 xl:justify-end xl:pt-1")}>
          <span className="text-xs font-semibold text-stone-400">特</span>
          <span
            className={cn(
              LOTTERY_BALL_BASE_CLASS,
              "special-ball bg-stone-800 text-white",
              ballSizeClass,
            )}
          >
            {specialNumber}
          </span>
        </div>
      ) : null}
    </div>
  );
}
