import * as React from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";

import type { ClusterData } from "@/types/clustering";

import Globe from "./Globe";

const state = vi.hoisted(() => ({
  items: [] as ClusterData[],
  props: null as null | { htmlElement: (item: ClusterData) => HTMLElement },
  select: vi.fn(),
  router: { push: vi.fn() },
  worldReady: true,
}));
vi.mock("next/dynamic", () => ({
  default: () => (props: typeof state.props) => {
    state.props = props;
    return null;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => state.router }));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/lib/globe/globeMaterial", () => ({ createGlobeMaterial: () => ({}) }));
vi.mock("@/lib/globe/worldGeoJson", () => ({
  getCachedWorldFeatures: () => (state.worldReady ? [] : null),
  loadWorldFeatures: () => (state.worldReady ? Promise.resolve([]) : new Promise(() => undefined)),
}));
vi.mock("@/hooks/useClustering", () => ({
  useClustering: () => ({
    visibleItems: state.items,
    handleClusterSelect: state.select,
    handleZoomChange: vi.fn(),
    handleGlobeRotation: vi.fn(),
    resetGlobe: vi.fn(),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("실제 라벨 렌더러가 줌 시 DOM을 재사용하고 기록 변경 후 최신 경로로 클릭한다", async () => {
  const dom = new JSDOM("", { url: "http://localhost" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("HTMLImageElement", dom.window.HTMLImageElement);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const item: ClusterData = {
    id: "KR_city_1",
    name: "서울",
    flag: "🇰🇷",
    lat: 37,
    lng: 127,
    color: "blue",
    count: 1,
    items: [{ id: "KR", name: "서울", flag: "🇰🇷", lat: 37, lng: 127, color: "blue", cityId: 1 }],
    clusterType: "individual_city",
    hasRecords: false,
  };
  state.items = [item];
  const root = createRoot(dom.window.document.createElement("div"));
  const render = async () =>
    act(async () => root.render(createElement(Globe, { travelPatterns: [], currentGlobeIndex: 0 })));
  await render();
  const accessor = state.props!.htmlElement;
  const element = accessor(item);
  const child = element.firstChild;
  const createElementSpy = vi.spyOn(dom.window.document, "createElement");
  state.router = { push: vi.fn() };
  state.items = [{ ...item, lat: 38 }];
  await render();
  expect(state.props!.htmlElement).toBe(accessor);
  expect(accessor(state.items[0])).toBe(element);
  expect(element.firstChild).toBe(child);
  expect(createElementSpy).not.toHaveBeenCalled();
  element.click();
  expect(state.router.push).toHaveBeenCalledWith("/image-metadata?cityId=1&city=%EC%84%9C%EC%9A%B8&country=");
  state.router.push.mockClear();
  state.items = [{ ...item, hasRecords: true, recordCount: 2, thumbnailUrl: "https://example.com/photo.jpg" }];
  await render();
  expect(accessor(state.items[0])).toBe(element);
  expect(element.querySelector("img")?.getAttribute("src")).toBe("https://example.com/photo.jpg");
  element.click();
  expect(state.router.push).toHaveBeenCalledTimes(1);
  expect(state.router.push).toHaveBeenCalledWith("/record/1");
  await act(async () => root.unmount());
});

it("지형 데이터가 로딩 중이면 내부 지구본도 진행 상태를 표시한다", async () => {
  const dom = new JSDOM("", { url: "http://localhost" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.worldReady = false;
  state.items = [];
  const container = dom.window.document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Globe, { travelPatterns: [], currentGlobeIndex: 0 })));
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain("지구본을 불러오는 중");
  } finally {
    await act(async () => root.unmount());
    state.worldReady = true;
    dom.window.close();
  }
});
