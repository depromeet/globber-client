import { afterEach, describe, expect, it, vi } from "vitest";

import {
  goBackOrFallback,
  hasInAppNavigation,
  isCurrentHistoryEntryInApp,
  markCurrentHistoryEntryInApp,
  markInAppNavigation,
} from "./navigation";

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

describe("현재 history 항목 표시", () => {
  const stubHistory = (initialState: unknown) => {
    const history = {
      state: initialState,
      replaceState: vi.fn((state: unknown) => {
        history.state = state;
      }),
    };
    vi.stubGlobal("window", { history });

    return history;
  };

  it("표시하지 않은 항목은 앱 안 이동으로 만들어진 항목이 아님", () => {
    stubHistory(null);

    expect(isCurrentHistoryEntryInApp()).toBe(false);
  });

  it("표시한 항목은 앱 안 이동으로 만들어진 항목이며 기존 state를 유지함", () => {
    const history = stubHistory({ __NA: true });

    markCurrentHistoryEntryInApp();

    expect(isCurrentHistoryEntryInApp()).toBe(true);
    expect(history.state).toEqual({ __NA: true, globberInApp: true });
  });

  it("history를 쓸 수 없으면 표시하지 않고 직접 진입으로 봄", () => {
    vi.stubGlobal("window", {
      history: {
        get state() {
          throw new Error("blocked");
        },
        replaceState: () => {
          throw new Error("blocked");
        },
      },
    });

    markCurrentHistoryEntryInApp();

    expect(isCurrentHistoryEntryInApp()).toBe(false);
  });
});
