import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { afterEach, expect, it, vi } from "vitest";

import GlobePage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "shared-globe" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/components/common/Button", () => ({ BackButton: () => null }));
vi.mock("@/components/common/Header", () => ({ Header: () => null }));
vi.mock("@/components/globe/GlobeFooter", () => ({ GlobeFooter: () => null }));
vi.mock("@/components/globe/GlobeHeader", () => ({ GlobeHeader: () => null }));
vi.mock("@/components/listView/ListView", () => ({ default: () => null }));
vi.mock("@/utils/cookies", () => ({ getAuthInfo: () => ({}) }));
vi.mock("@/services/bookmarkService", () => ({ getBookmarks: vi.fn() }));
vi.mock("@/services/diaryService", () => ({ getDiariesList: vi.fn() }));
vi.mock("@/services/memberService", () => ({
  getGlobeData: () => new Promise(() => undefined),
  getTravelInsight: () => new Promise(() => undefined),
}));

let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it("공유 지구본 응답이 대기 중이면 빈 화면 대신 로딩 상태를 보여 준다", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("sessionStorage", { getItem: () => null });
  await act(() => {
    renderer = create(createElement(GlobePage));
  });
  expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("지구본을 불러오는 중");
});
