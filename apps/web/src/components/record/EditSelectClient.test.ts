import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { City } from "@globber/shared/types/city";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { parseJsonQueryParam } from "@/utils/jsonQueryParam";

import { EditSelectClient } from "./EditSelectClient";

const { router, nationSelect } = vi.hoisted(() => ({
  router: { push: vi.fn() },
  nationSelect: { onComplete: null as ((cities: City[]) => void) | null },
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/common/Header", () => ({ Header: () => null }));
vi.mock("@/components/nationSelect/NationSelectClient", () => ({
  NationSelectClient: ({ onComplete }: { onComplete: (cities: City[]) => void }) => {
    nationSelect.onComplete = onComplete;
    return null;
  },
}));

const percentCity: City = {
  id: "77",
  name: "100% 시티",
  country: "테스트",
  flag: "",
  lat: 1,
  lng: 2,
  countryCode: "KR",
};

let renderer: ReactTestRenderer;

/** 편집 화면이 받는 것처럼 router.push 주소의 쿼리를 한 번 디코딩해 읽음 */
const pushedParams = () => new URLSearchParams(String(router.push.mock.calls.at(-1)?.[0]).split("?")[1]);

const complete = async (props: { addedParam?: string; removedParam?: string }) => {
  await act(() => {
    renderer = create(createElement(EditSelectClient, { initialCities: [], ...props }));
  });
  await act(() => nationSelect.onComplete?.([percentCity]));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it("이름에 %가 들어간 도시를 골라도 편집 화면에서 추가한 도시 목록이 그대로 읽힌다", async () => {
  await complete({ addedParam: JSON.stringify([{ id: 9, name: "도쿄", countryCode: "JP", lat: 3, lng: 4 }]) });

  const added = parseJsonQueryParam(pushedParams().get("added"));

  expect(added).toEqual([
    { id: 9, name: "도쿄", countryCode: "JP", lat: 3, lng: 4 },
    { id: "77", name: "100% 시티", country: "테스트", countryCode: "KR", lat: 1, lng: 2 },
  ]);
});

it("삭제 목록도 한 번만 인코딩하고, 방금 다시 추가한 도시는 삭제 목록에서 뺀다", async () => {
  await complete({ removedParam: JSON.stringify(["77", "5"]) });

  expect(pushedParams().get("removed")).toBe(JSON.stringify(["5"]));
});

it("이전 방식으로 두 번 인코딩된 삭제 목록도 읽는다", async () => {
  await complete({ removedParam: encodeURIComponent(JSON.stringify(["77", "5"])) });

  expect(pushedParams().get("removed")).toBe(JSON.stringify(["5"]));
});
