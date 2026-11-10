import type { ErrorType } from "../types/error";

export const ERROR_TYPES = ["401", "404", "500"] as const satisfies readonly ErrorType[];

export const DEFAULT_ERROR_TYPE: ErrorType = "500";

export const ERROR_PAGE_PATH = "/error";

export const ERROR_TYPE_PARAM = "type";

// 500 오류가 난 화면 주소. 오류 화면의 "다시 시도"가 이 주소를 다시 연다 (GLB-135)
export const ERROR_FROM_PARAM = "from";
