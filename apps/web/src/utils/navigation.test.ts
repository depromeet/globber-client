import { afterEach, describe, expect, it, vi } from "vitest";

import { goBackOrFallback } from "./navigation";

const createRouter = () => ({ back: vi.fn(), push: vi.fn() });

afterEach(() => vi.unstubAllGlobals());

describe("goBackOrFallback", () => {
  it("방문 기록이 있으면 뒤로 감", () => {
    vi.stubGlobal("window", { history: { length: 3 } });
    const router = createRouter();

    goBackOrFallback(router, "/profile");

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("새 탭으로 바로 들어와 방문 기록이 없으면 기본 경로로 이동함", () => {
    vi.stubGlobal("window", { history: { length: 1 } });
    const router = createRouter();

    goBackOrFallback(router, "/profile");

    expect(router.push).toHaveBeenCalledWith("/profile");
    expect(router.back).not.toHaveBeenCalled();
  });
});
