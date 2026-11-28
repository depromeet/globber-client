import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { EditClient } from "./EditClient";

const navigation = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  params: new URLSearchParams(),
}));
const api = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params,
}));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/assets/icons", () => ({ IconExclamationCircleMonoIcon: () => null }));
vi.mock("@/hooks/mutation/useMemberMutation", () => ({
  useCreateMemberTravelsMutation: () => ({ mutateAsync: api.create }),
  useDeleteMemberTravelMutation: () => ({ mutateAsync: api.remove }),
}));
vi.mock("@/utils/cookies", () => ({ getAuthInfo: () => ({ token: "token" }) }));
vi.mock("@/components/common/GlobalToast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/common/Header", () => ({
  Header: ({ onLeftClick, onRightClick }: { onLeftClick: () => void; onRightClick: () => void }) =>
    createElement(
      "div",
      null,
      createElement("button", { onClick: onLeftClick, "aria-label": "뒤로가기" }),
      createElement("button", { onClick: onRightClick, "aria-label": "저장" })
    ),
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
  navigation.params = new URLSearchParams();
  dom = new JSDOM("", { url: "https://globber.world/record/edit" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  vi.useRealTimers();
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

const seoul = { id: "1", name: "서울", countryCode: "KR", lat: 37.5, lng: 127, cityId: 1 };
const tokyo = { id: "2", name: "도쿄", countryCode: "JP", lat: 35.7, lng: 139.7, cityId: 2 };
const paris = { id: "3", name: "파리", countryCode: "FR", lat: 48.9, lng: 2.4, cityId: 3 };
const rome = { id: "rome", name: "로마", countryCode: "IT", lat: 41.9, lng: 12.5, isNew: true };

const save = async () => {
  await act(async () => {
    const saving = renderer.root.findByProps({ "aria-label": "저장" }).props.onClick();
    await vi.advanceTimersByTimeAsync(1300);
    await saving;
  });
};

it("추가·삭제를 함께 저장하다 일부만 실패하면 다시 저장할 때 실패한 요청만 다시 보낸다", async () => {
  vi.useFakeTimers();
  navigation.params = new URLSearchParams({ removed: JSON.stringify(["2", "3"]) });
  api.create.mockResolvedValue({ data: { recordsCreated: 1 } });
  api.remove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("삭제 실패"));
  await act(() => {
    renderer = create(createElement(EditClient, { cities: [seoul, rome], deletedCities: [tokyo, paris] }));
  });

  await save();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.remove.mock.calls.map(([{ cityId }]) => cityId)).toEqual([2, 3]);
  expect(navigation.router.push).not.toHaveBeenCalledWith("/record");

  api.remove.mockResolvedValue(undefined);
  await save();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.remove.mock.calls.map(([{ cityId }]) => cityId)).toEqual([2, 3, 3]);
  expect(navigation.router.push).toHaveBeenCalledWith("/record");
});

it("추가 요청만 실패했으면 다시 저장할 때 삭제는 다시 보내지 않고 추가만 다시 보낸다", async () => {
  vi.useFakeTimers();
  navigation.params = new URLSearchParams({ removed: JSON.stringify(["2"]) });
  api.create.mockRejectedValueOnce(new Error("추가 실패")).mockResolvedValue({ data: { recordsCreated: 1 } });
  api.remove.mockResolvedValue(undefined);
  await act(() => {
    renderer = create(createElement(EditClient, { cities: [seoul, rome], deletedCities: [tokyo] }));
  });

  await save();
  await save();

  expect(api.remove).toHaveBeenCalledTimes(1);
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[1][0].cities.map((city: { id: string }) => city.id)).toEqual(["rome"]);
  expect(navigation.router.push).toHaveBeenCalledWith("/record");
});
