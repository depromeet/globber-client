import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { logger } from "./logger";

const spies = () => ({
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("개발 환경에서는 debug·warn·error를 모두 출력한다", () => {
  vi.stubEnv("NODE_ENV", "development");
  const s = spies();
  const error = new Error("실패");
  logger.debug("a", 1);
  logger.warn("b");
  logger.error("c", error);
  expect(s.log).toHaveBeenCalledWith("a", 1);
  expect(s.warn).toHaveBeenCalledWith("b");
  expect(s.error).toHaveBeenCalledWith("c", error);
});

it("운영 브라우저에서는 아무것도 출력하지 않는다", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("window", {});
  const s = spies();
  logger.debug("a");
  logger.warn("b");
  logger.error("c", new Error("실패"));
  expect(s.log).not.toHaveBeenCalled();
  expect(s.warn).not.toHaveBeenCalled();
  expect(s.error).not.toHaveBeenCalled();
});

it("운영 서버에서는 error만 메시지와 오류 요약 한 줄로 남긴다", () => {
  vi.stubEnv("NODE_ENV", "production");
  const s = spies();
  logger.debug("a");
  logger.warn("b");
  logger.error("로그인 실패", new TypeError("fetch failed"));
  logger.error("필수 값 없음");
  expect(s.log).not.toHaveBeenCalled();
  expect(s.warn).not.toHaveBeenCalled();
  expect(s.error).toHaveBeenNthCalledWith(1, "로그인 실패 TypeError: fetch failed");
  expect(s.error).toHaveBeenNthCalledWith(2, "필수 값 없음");
});
