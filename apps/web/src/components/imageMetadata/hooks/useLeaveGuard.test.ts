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
  let release: () => Promise<boolean>;
  const onBlocked = vi.fn();
  let block = false;

  const render = async (armed: boolean, enabled = true) => {
    const Probe = ({ isArmed }: { isArmed: boolean }) => {
      const value = useLeaveGuard({ enabled, armed: isArmed, shouldBlock: () => block, onBlocked });
      useLayoutEffect(() => {
        release = value.release;
      });
      return null;
    };
    await act(async () => {
      if (renderer) renderer.update(createElement(Probe, { isArmed: armed }));
      else renderer = create(createElement(Probe, { isArmed: armed }));
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
    await render(true);
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
    let released: boolean | undefined;
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
    let released: boolean | undefined;
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
    let released: boolean | undefined;
    await act(async () => {
      released = await release();
    });
    expect(released).toBe(false);
  });

  it("enabled가 false면 표시도 가드도 남기지 않는다", async () => {
    await render(true, false);
    expect(fake.entries).toEqual([{ page: "A" }, { page: "P" }, { page: "E" }]);
  });
});
