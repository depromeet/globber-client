import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => createElement("img", { alt }),
}));
vi.mock("@/utils/sentry", () => ({ reportError: vi.fn() }));

let renderer: ReactTestRenderer;
let dom: JSDOM;

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  dom?.window.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("실제 오류 경계가 서비스 오류 화면을 표시하고 다시 시도로 복구한다", async () => {
  dom = new JSDOM("", { url: "https://globber.world/record" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  let shouldThrow = true;
  const Content = () => {
    if (shouldThrow) throw new Error("내부 오류 세부 정보");
    return createElement("p", null, "복구됨");
  };
  await act(() => {
    renderer = create(createElement(ErrorBoundary, null, createElement(Content)));
  });
  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain("일시적인 오류가 발생했어요.");
  expect(output).not.toContain("내부 오류 세부 정보");
  shouldThrow = false;
  const retry = renderer.root.findAllByType("button").find(button => button.children.includes("다시 시도"));
  expect(retry).toBeDefined();
  await act(() => retry!.props.onClick());
  expect(JSON.stringify(renderer.toJSON())).toContain("복구됨");
});
