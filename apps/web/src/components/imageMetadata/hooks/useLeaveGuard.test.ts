import { createElement, useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAVE_GUARD_KEY, useLeaveGuard } from "./useLeaveGuard";

type Entry = Record<string, unknown> | null;

/** 브라우저 history를 흉내 낸다. back은 실제처럼 비동기로 popstate를 보낸다 */
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
      if (index === 0) return;
      index -= 1;
      setTimeout(() => {
        const event = new Event("popstate") as PopStateEvent;
        Object.defineProperty(event, "state", { value: entries[index] });
        target.dispatchEvent(event);
      }, 0);
    },
  };
  return {
    window: {
      history,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
    entries,
    get index() {
      return index;
    },
  };
};

const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 5)));

describe("useLeaveGuard (GLB-134)", () => {
  let fake: ReturnType<typeof createFakeWindow>;
  let renderer: ReactTestRenderer;
  let release: () => Promise<void>;
  const onBlocked = vi.fn();
  let block = false;

  const mount = async (enabled = true) => {
    const Probe = () => {
      const value = useLeaveGuard({ enabled, shouldBlock: () => block, onBlocked });
      useLayoutEffect(() => {
        release = value.release;
      });
      return null;
    };
    await act(async () => {
      renderer = create(createElement(Probe));
    });
  };

  beforeEach(() => {
    fake = createFakeWindow([{ page: "record" }, { page: "edit" }]);
    vi.stubGlobal("window", fake.window);
    onBlocked.mockReset();
    block = false;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    vi.unstubAllGlobals();
  });

  it("화면에 들어오면 같은 화면의 가드 항목을 하나 쌓는다", async () => {
    await mount();
    expect(fake.entries).toHaveLength(3);
    expect(fake.entries[2]).toMatchObject({ page: "edit", [LEAVE_GUARD_KEY]: true });
  });

  it("변경 내용이 있으면 브라우저 뒤로가기를 막고 확인 창을 연다", async () => {
    block = true;
    await mount();
    fake.window.history.back();
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    // 가드 항목을 다시 쌓아 계속 같은 화면에 머문다
    expect(fake.entries[fake.index]).toMatchObject({ [LEAVE_GUARD_KEY]: true });
  });

  it("변경 내용이 없으면 한 번 더 뒤로 가 이전 화면으로 보낸다", async () => {
    await mount();
    fake.window.history.back();
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(fake.entries[fake.index]).toEqual({ page: "record" });
  });

  it("바텀시트 항목에서 가드로 돌아오는 뒤로가기는 막지 않는다", async () => {
    block = true;
    await mount();
    fake.window.history.pushState({ bottomSheetOpen: true });
    fake.window.history.back();
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(fake.entries[fake.index]).toMatchObject({ [LEAVE_GUARD_KEY]: true });
  });

  it("release는 가드와 그 위에 남은 바텀시트 항목을 걷어 내 원래 항목으로 돌아간다", async () => {
    block = true;
    await mount();
    // X로 닫힌 바텀시트가 남긴 항목(GLB-188)
    fake.window.history.pushState(null);
    let released = false;
    await act(async () => {
      release().then(() => {
        released = true;
      });
    });
    await flush();
    await flush();
    expect(released).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(fake.entries[fake.index]).toEqual({ page: "edit" });
  });

  it("enabled가 false면 가드 항목을 쌓지 않는다", async () => {
    await mount(false);
    expect(fake.entries).toHaveLength(2);
  });
});
