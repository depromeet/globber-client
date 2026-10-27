import type { ErrorType } from "../types/error";

export const ERROR_TYPES = ["401", "404", "500"] as const satisfies readonly ErrorType[];

export const DEFAULT_ERROR_TYPE: ErrorType = "500";

export const ERROR_PAGE_PATH = "/error";

export const ERROR_TYPE_PARAM = "type";
