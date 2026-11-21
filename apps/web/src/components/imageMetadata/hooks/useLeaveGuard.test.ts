import { createElement, useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAVE_BASE_KEY, LEAVE_GUARD_KEY, useLeaveGuard } from "./useLeaveGuard";

type Entry = Record<string, unknown> | null;

/**
 * 브라우저 history를 흉내 낸다
 * 실제 브라우저처럼 back은 비동기로 이동하고, 이동이 끝난 뒤에 state가 바뀌고 popstate가 온다
 */
const createFakeWindow = (initial: Entry[]) => {
  const target = new EventTarget();
  const entries = [...initial];
  let index = entries.length - 1;
  const history = {
    get state() {
      return entries[index];
    },
    pushState(state: Entry) {
      entries.splice(index + 1);
      entries.push(state);
      index = entries.length - 1;
    },
    replaceState(state: Entry) {
      entries[index] = state;
    },
    back() {
      setTimeout(() => {
        if (index === 0) return;
        index -= 1;
        const event = new Event("popstate") as PopStateEvent;
        Object.defineProperty(event, "state", { value: entries[index] });
        target.dispatchEvent(event);
      }, 0);
    },
  };
  return {
    window: {
      history,
      // 항목의 url(없으면 작성 화면 주소)을 현재 주소로 쓴다
      get location() {
        const url = new URL(String(entries[index]?.url ?? "/image-metadata?diaryId=1"), "https://test.local");
        return { pathname: url.pathname, search: url.search };
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
    entries,
    get index() {
      return index;
    },
    get current() {
      return entries[index];
    },
  };
};

const flush = (ms = 10) => act(() => new Promise(resolve => setTimeout(resolve, ms)));

describe("useLeaveGuard (GLB-134)", () => {
  let fake: ReturnType<typeof createFakeWindow>;
  let renderer: ReactTestRenderer | undefined;
  let release: () => Promise<boolean | null>;
  const onBlocked = vi.fn();
  let block = false;

  // 같은 컴포넌트 인스턴스에서 armed가 바뀌는 것을 확인하도록 Probe는 한 번만 정의한다
  const Probe = ({ armed, enabled }: { armed: boolean; enabled: boolean }) => {
    const value = useLeaveGuard({ enabled, armed, shouldBlock: () => block, onBlocked });
    useLayoutEffect(() => {
      release = value.release;
    });
    return null;
  };

  const render = async (armed: boolean, enabled = true) => {
    await act(async () => {
      if (renderer) renderer.update(createElement(Probe, { armed, enabled }));
      else renderer = create(createElement(Probe, { armed, enabled }));
    });
  };

  beforeEach(() => {
    // A(이전의 이전 화면) → P(바로 전 화면) → E(작성 화면)
    fake = createFakeWindow([{ page: "A" }, { page: "P" }, { page: "E" }]);
    vi.stubGlobal("window", fake.window);
    onBlocked.mockReset();
    block = false;
    renderer = undefined;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    vi.unstubAllGlobals();
  });

  it("변경 내용이 없으면 history를 쌓지 않고 원래 항목에 표시만 남긴다", async () => {
    await render(false);
    expect(fake.entries).toHaveLength(3);
    expect(fake.current).toMatchObject({ page: "E", [LEAVE_BASE_KEY]: expect.any(String) });
  });

  it("변경 내용이 없을 때 브라우저 뒤로가기는 한 번에 바로 전 화면(P)으로 간다", async () => {
    await render(false);
    fake.window.history.back();
    await flush();
    expect(fake.current).toEqual({ page: "P" });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("변경 내용이 생기면 가드를 쌓고, 뒤로가기를 막아 확인 창을 연다", async () => {
    block = true;
    await render(false);
    const baseId = (fake.current as Record<string, unknown>)[LEAVE_BASE_KEY];
    await render(true);
    // 같은 화면 인스턴스이므로 원래 항목 표시는 그대로이고 가드에도 같은 값을 쓴다
    expect(fake.entries[2]).toMatchObject({ [LEAVE_BASE_KEY]: baseId });
    expect(fake.current).toMatchObject({ [LEAVE_GUARD_KEY]: baseId });
    expect(fake.entries).toHaveLength(4);
    expect(fake.current).toMatchObject({ page: "E", [LEAVE_GUARD_KEY]: expect.any(String) });
    fake.window.history.back();
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(fake.current).toMatchObject({ [LEAVE_GUARD_KEY]: expect.any(String) });
    expect(fake.current).not.toHaveProperty(LEAVE_BASE_KEY);
  });

  it("바텀시트 항목에서 가드로 돌아오는 뒤로가기는 막지 않는다", async () => {
    block = true;
    await render(true);
    fake.window.history.pushState({ bottomSheetOpen: true });
    fake.window.history.back();
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(fake.current).toMatchObject({ [LEAVE_GUARD_KEY]: expect.any(String) });
  });

  it("나가기: release 뒤 한 번 뒤로가면 P에 머물고 더 건너뛰지 않는다", async () => {
    block = true;
    await render(true);
    let released: boolean | null | undefined;
    await act(async () => {
      released = await release();
    });
    expect(released).toBe(true);
    expect(fake.current).toMatchObject({ page: "E", [LEAVE_BASE_KEY]: expect.any(String) });
    // 헤더 나가기의 router.back()
    block = false;
    fake.window.history.back();
    await flush(30);
    expect(fake.current).toEqual({ page: "P" });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("바텀시트가 남긴 항목이 여러 개여도 release는 원래 항목까지 돌아간다", async () => {
    block = true;
    await render(true);
    for (let i = 0; i < 7; i += 1) fake.window.history.pushState(null);
    let released: boolean | null | undefined;
    await act(async () => {
      released = await release();
    });
    expect(released).toBe(true);
    expect(fake.current).toMatchObject({ page: "E", [LEAVE_BASE_KEY]: expect.any(String) });
  });

  it("원래 항목 표시를 잃어 돌아갈 곳을 못 찾으면 release는 false를 돌려준다", async () => {
    block = true;
    await render(true);
    // 다른 코드가 원래 항목의 표시를 지운 경우
    fake.entries[2] = { page: "E" };
    let released: boolean | null | undefined;
    await act(async () => {
      released = await release();
    });
    expect(released).toBe(false);
  });

  it("원래 항목을 지나 다른 주소에 닿으면 바로 멈추고 false를 돌려준다", async () => {
    fake = createFakeWindow([{ page: "A", url: "/record" }, { page: "E" }]);
    vi.stubGlobal("window", fake.window);
    block = true;
    await render(true);
    // 원래 항목 표시가 지워진 경우
    fake.entries[1] = { page: "E" };
    let released: boolean | null | undefined;
    await act(async () => {
      released = await release();
    });
    expect(released).toBe(false);
    expect(fake.current).toEqual({ page: "A", url: "/record" });
  });

  it("중복 호출은 같은 결과를 기다리고, 화면이 사라지면 null로 멈춘다", async () => {
    block = true;
    await render(true);
    for (let i = 0; i < 3; i += 1) fake.window.history.pushState(null);
    const first = release();
    const second = release();
    expect(second).toBe(first);
    await act(async () => {
      renderer?.unmount();
      renderer = undefined;
    });
    expect(await first).toBeNull();
    await flush(30);
    // 멈춘 뒤에는 history를 더 움직이지 않는다
    expect(fake.index).toBeGreaterThanOrEqual(3);
  });

  it("enabled가 false면 표시도 가드도 남기지 않는다", async () => {
    await render(true, false);
    expect(fake.entries).toEqual([{ page: "A" }, { page: "P" }, { page: "E" }]);
  });
});
