import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import type { GlobeInstance } from "globe.gl";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useClustering } from "./useClustering";

describe("회전 중 화면 클러스터 갱신", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("줌이 그대로여도 최신 카메라 화면 좌표로 다시 계산한다", async () => {
    vi.useFakeTimers();
    const dom = new JSDOM();
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let separation = 500;
    const getScreenCoords = vi.fn((_lat: number, lng: number) => ({ x: lng * separation, y: 0 }));
    const globeRef = { current: { getScreenCoords } as unknown as GlobeInstance };
    const countries = [
      { id: "FRA", name: "파리", lat: 48, lng: 2, flag: "🇫🇷", color: "blue" },
      { id: "BEL", name: "브뤼셀", lat: 50, lng: 4, flag: "🇧🇪", color: "blue" },
    ];
    let result: ReturnType<typeof useClustering>;
    const onSelectedDataChange = vi.fn();
    const onSnapZoomChange = vi.fn();
    const Harness = () => {
      const clustering = useClustering({ countries, globeRef, zoomLevel: 2, onSelectedDataChange, onSnapZoomChange });
      useLayoutEffect(() => {
        result = clustering;
      });
      return null;
    };
    const root = createRoot(dom.window.document.createElement("div"));
    await act(async () => root.render(createElement(Harness)));
    expect(result!.visibleItems).toHaveLength(2);
    const callsBeforeRotation = getScreenCoords.mock.calls.length;
    await act(async () => {
      result!.handleGlobeRotation(0, 5);
      separation = 1;
      result!.handleGlobeRotation(0, 10);
      vi.advanceTimersByTime(99);
    });
    expect(getScreenCoords).toHaveBeenCalledTimes(callsBeforeRotation);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(getScreenCoords).toHaveBeenCalledTimes(callsBeforeRotation + 3);
    expect(result!.visibleItems).toHaveLength(1);
    expect(result!.visibleItems[0].clusterType).toBe("continent_cluster");
    await act(async () => root.unmount());
  });
});
