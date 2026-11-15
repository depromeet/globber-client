import { afterEach, describe, expect, it, vi } from "vitest";

import { goBackOrFallback, hasInAppNavigation, markInAppNavigation } from "./navigation";

const createRouter = () => ({ back: vi.fn(), push: vi.fn() });

const stubWindow = (historyLength: number) => {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    history: { length: historyLength },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe("goBackOrFallback", () => {
  it("앱 안에서 이동해 온 화면이면 뒤로 감", () => {
    stubWindow(3);
    markInAppNavigation();
    const router = createRouter();

    goBackOrFallback(router, "/profile");

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("새 탭으로 바로 들어와 history.length가 2여도 앱 안 이동 기록이 없으면 기본 경로로 이동함", () => {
    stubWindow(2);
    const router = createRouter();

    goBackOrFallback(router, "/profile");

    expect(router.push).toHaveBeenCalledWith("/profile");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("sessionStorage를 쓸 수 없으면 기본 경로로 이동함", () => {
    vi.stubGlobal("window", {
      history: { length: 5 },
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    const router = createRouter();

    markInAppNavigation();
    goBackOrFallback(router, "/");

    expect(hasInAppNavigation()).toBe(false);
    expect(router.push).toHaveBeenCalledWith("/");
  });
});
