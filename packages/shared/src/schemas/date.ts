import { z } from "zod";

// 날짜 형식 검증 (YYYY.MM)
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}\.\d{2}$/, { message: "YYYY.MM 형식으로 입력해주세요." })
  .refine(
    value => {
      const [, month] = value.split(".").map(Number);
      return month >= 1 && month <= 12;
    },
    { message: "유효한 월(01-12)을 입력해주세요." }
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
