import { LOTTERY_CONFIG, type LotteryType, padBallNumber } from "../../shared/lottery";

export function rocDateToIso(value: string): string {
  const match = value.trim().match(/^(\d{1,3})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!match) throw new Error("日期格式必須為民國年 YYY.MM.DD，例如 115.07.08");

  const year = Number(match[1]) + 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("開獎日期不是有效日期");
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export function isoDateToRoc(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("日期格式必須為 YYYY-MM-DD");
  const rocYear = Number(match[1]) - 1911;
  if (rocYear <= 0) throw new Error("日期必須晚於民國元年");
  return `${rocYear.toString().padStart(3, "0")}.${match[2]}.${match[3]}`;
}

export function validateDrawNumbers(lotteryType: LotteryType, values: Array<string | number>): string[] {
  const config = LOTTERY_CONFIG[lotteryType];
  if (values.length !== config.ballCount) {
    throw new Error(`${config.name} 必須輸入 ${config.ballCount} 個號碼`);
  }

  const normalized = values.map((raw, index) => {
    const value = Number(String(raw).trim());
    const range = config.numberRanges[index];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new Error(
        `${config.name}第 ${index + 1} 個號碼必須介於 ${range.min}～${range.max}`,
      );
    }
    return padBallNumber(value);
  });

  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${config.name}的基本號碼不可重複`);
  }

  return normalized;
}

export function validateSpecialNumber(
  lotteryType: LotteryType,
  value: string | number | null | undefined,
  basicNumbers: string[] = [],
): string | null {
  const config = LOTTERY_CONFIG[lotteryType];
  const range = config.specialNumberRange;
  const isEmpty = value === null || value === undefined || String(value).trim() === "";
  if (!range) {
    if (!isEmpty) throw new Error(`${config.name}不使用特別號`);
    return null;
  }
  if (isEmpty) throw new Error(`${config.name}必須輸入特別號`);
  const number = Number(String(value).trim());
  if (!Number.isInteger(number) || number < range.min || number > range.max) {
    throw new Error(`特別號必須介於 ${range.min}～${range.max}`);
  }
  const normalized = padBallNumber(number);
  if (lotteryType !== "superLotto638" && basicNumbers.includes(normalized)) {
    throw new Error("特別號不可與一般號碼重複");
  }
  return normalized;
}

export function parseRapidNumberInput(lotteryType: LotteryType, input: string): string[] {
  const trimmed = input.trim();
  const tokens = /[\s,，、-]/.test(trimmed)
    ? trimmed.split(/[\s,，、-]+/).filter(Boolean)
    : trimmed.replace(/\D/g, "").match(/\d{2}/g) ?? [];
  return validateDrawNumbers(lotteryType, tokens);
}
