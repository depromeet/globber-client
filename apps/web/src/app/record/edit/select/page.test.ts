import { beforeEach, expect, it, vi } from "vitest";

import EditSelectPage from "./page";

const { travels, cities, redirect, auth } = vi.hoisted(() => ({
  travels: vi.fn(),
  cities: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  auth: { token: "token" as string | null },
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/config/env", () => ({ env: { IS_LOCAL_DEV: false } }));
vi.mock("@/utils/serverCookies", () => ({ getServerAuthInfo: async () => ({ token: auth.token }) }));
vi.mock("@/services/memberService", () => ({ getMemberTravels: travels }));
vi.mock("@/services/cityService", () => ({ fetchCities: cities }));
vi.mock("@/components/record/EditSelectClient", () => ({ EditSelectClient: () => null }));
vi.mock("@/lib/apiClient", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
    }
  },
}));

const added = encodeURIComponent(JSON.stringify([{ id: 9, name: "도쿄" }]));
const removed = encodeURIComponent(JSON.stringify([2]));
const render = async () => {
  const element = await EditSelectPage({ searchParams: Promise.resolve({ added, removed }) } as never);
  return (element as { props: Record<string, unknown> }).props;
};

beforeEach(() => {
  auth.token = "token";
  travels.mockReset();
  cities.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  travels.mockResolvedValue({
    data: { travels: [{ cities: [{ cityId: 1 }, { cityId: 2 }] }] },
  });
  cities.mockResolvedValue([{ id: 1, name: "서울" }]);
});

it("정상이면 삭제한 도시를 뺀 등록 도시와 편집 중 선택을 넘긴다", async () => {
  const props = await render();
  expect(props.isLoadError).toBe(false);
  expect(props.registeredCityIds).toEqual(["1"]);
  expect(props.initialCities).toEqual([{ id: 1, name: "서울" }]);
  expect(props.addedParam).toBe(added);
  expect(props.removedParam).toBe(removed);
});

it("도시 조회에 실패해도 편집 중 선택은 넘기고 실패 안내를 켠다 (GLB-389)", async () => {
  cities.mockRejectedValue(new Error("5xx"));
  const props = await render();
  expect(props.isLoadError).toBe(true);
  expect(props.initialCities).toEqual([]);
  expect(props.addedParam).toBe(added);
  expect(props.removedParam).toBe(removed);
});

it.each([
  ["예외", () => travels.mockRejectedValue(new Error("네트워크"))],
  ["null 응답", () => travels.mockResolvedValue(null)],
])("내 여행 조회 실패(%s)면 등록 도시를 모르므로 실패 안내를 켠다 (GLB-389)", async (_, fail) => {
  fail();
  const props = await render();
  expect(props.isLoadError).toBe(true);
  expect(props.addedParam).toBe(added);
});

it("내 여행 조회가 401이면 로그인 만료 화면으로 보낸다", async () => {
  const { ApiError } = await import("@/lib/apiClient");
  travels.mockRejectedValue(new (ApiError as unknown as new (m: string, s: number) => Error)("만료", 401));
  await expect(render()).rejects.toThrow("NEXT_REDIRECT /error?type=401");
});
