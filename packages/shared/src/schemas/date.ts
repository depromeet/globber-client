import { z } from "zod";

// 기록 날짜로 입력할 수 있는 가장 이른 연도. 0000.01, 9999.12 같은 값을 막는다 (GLB-260)
export const MIN_RECORD_YEAR = 1900;
export const YEAR_MONTH_RANGE_MESSAGE = `${MIN_RECORD_YEAR}년 1월부터 이번 달까지 입력할 수 있어요.`;

// 아직 오지 않은 달인지 사용자 기기의 현재 날짜 기준으로 판단한다
const isFutureYearMonth = (year: number, month: number, now: Date) =>
  year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

// 날짜 형식 검증 (YYYY.MM). 형식·월 범위를 본 뒤, 1900년 1월부터 이번 달까지만 허용한다
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}\.\d{2}$/, { message: "YYYY.MM 형식으로 입력해주세요." })
  .refine(
    value => {
      const [, month] = value.split(".").map(Number);
      return month >= 1 && month <= 12;
    },
    { message: "유효한 월(01-12)을 입력해주세요." }
  )
  .refine(
    value => {
      const [year, month] = value.split(".").map(Number);
      return year >= MIN_RECORD_YEAR && !isFutureYearMonth(year, month, new Date());
    },
    { message: YEAR_MONTH_RANGE_MESSAGE }
  );

// 날짜 선택 폼 스키마
export const dateSelectSchema = z.object({
  date: yearMonthSchema,
});

export type DateSelectFormData = z.infer<typeof dateSelectSchema>;

// 날짜 형식화 헬퍼 함수
export const formatYearMonth = (digits: string) => {
  if (digits.length === 0) return "";
  if (digits.length <= 4) return digits;

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
};

// 숫자만 추출하는 헬퍼 함수
export const extractDigits = (value: string) => value.replace(/[^\d]/g, "");

// 날짜 유효성 검사 헬퍼 함수
export const isValidYearMonth = (value: string) => {
  const result = yearMonthSchema.safeParse(value);

  return result.success;
};
