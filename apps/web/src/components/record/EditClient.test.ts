import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { EditClient } from "./EditClient";

const navigation = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params,
}));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/assets/icons", () => ({ IconExclamationCircleMonoIcon: () => null }));
vi.mock("@/hooks/mutation/useMemberMutation", () => ({
  useCreateMemberTravelsMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteMemberTravelMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/common/Header", () => ({
  Header: ({ onLeftClick }: { onLeftClick: () => void }) =>
    createElement("button", { onClick: onLeftClick, "aria-label": "뒤로가기" }),
}));
vi.mock("@/components/common/Dialog", () => {
  const Container = ({ children }: { children?: import("react").ReactNode }) => createElement("div", null, children);
  return Object.fromEntries(
    ["Dialog", "DialogBody", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(name => [
      name,
      Container,
    ])
  );
});
vi.mock("@/components/imageMetadata/LoadingOverlay", () => ({ LoadingOverlay: () => null }));
vi.mock("./EditContent", () => ({ EditContent: () => null }));
vi.mock("./EditToast", () => ({ EditToastContainer: () => null, toast: { success: vi.fn(), error: vi.fn() } }));

let renderer: ReactTestRenderer;
let dom: JSDOM;

beforeEach(() => {
  vi.clearAllMocks();
  dom = new JSDOM("", { url: "https://globber.world/record/edit" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

it("브라우저 뒤로가기가 새 history 항목을 만들어 편집 화면으로 순환하지 않는다", async () => {
  await act(() => {
    renderer = create(createElement(EditClient, { cities: [] }));
  });
  await act(() => {
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
  });
  expect(navigation.router.push).not.toHaveBeenCalled();
});

it("헤더 뒤로가기도 편집 화면을 history에 추가하지 않고 기록 목록으로 나간다", async () => {
  await act(() => {
    renderer = create(createElement(EditClient, { cities: [] }));
  });
  await act(() => renderer.root.findByProps({ "aria-label": "뒤로가기" }).props.onClick());
  expect(navigation.router.replace).toHaveBeenCalledWith("/record");
  expect(navigation.router.push).not.toHaveBeenCalled();
});
