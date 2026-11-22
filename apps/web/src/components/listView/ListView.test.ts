import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { TravelPattern } from "@globber/shared/types/travelPatterns";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import ListView from "./ListView";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/components/common/ImageFallback", () => ({ ImageFallback: () => null }));

const sameNameCity = (cityId: number) => ({
  id: "US",
  name: "Portland, United States",
  flag: "🇺🇸",
  lat: cityId,
  lng: cityId,
  color: "#fff",
  cityId,
  hasRecords: true,
});

const travelPatterns: TravelPattern[] = [
  { title: "", subtitle: "", countries: [sameNameCity(101), sameNameCity(202)] },
];

let renderer: ReactTestRenderer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("같은 나라에 이름이 같은 도시가 있어도 key가 겹치지 않고 각 도시로 이동한다", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  await act(() => {
    renderer = create(createElement(ListView, { travelPatterns }));
  });

  const duplicateKeyWarnings = consoleError.mock.calls.filter(args => String(args[0]).includes("same key"));
  expect(duplicateKeyWarnings).toEqual([]);

  const cityButtons = renderer.root.findAll(
    node => node.type === "button" && node.props.type === "button" && node.props.disabled === false
  );
  expect(cityButtons).toHaveLength(2);

  await act(() => cityButtons[1].props.onClick());
  expect(String(router.push.mock.calls[0][0])).toContain("202");
});
