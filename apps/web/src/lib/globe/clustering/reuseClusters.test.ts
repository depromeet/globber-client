import { expect, it } from "vitest";

import type { ClusterData } from "@/types/clustering";

import { reuseClusters } from "./reuseClusters";

const city = { id: "KOR", cityId: 1, name: "서울", lat: 37, lng: 127, flag: "🇰🇷", color: "blue" };

const makeCluster = (overrides: Partial<ClusterData> = {}): ClusterData => ({
  id: "country_KOR",
  name: "한국",
  flag: "🇰🇷",
  lat: 37,
  lng: 127,
  color: "blue",
  items: [city],
  count: 1,
  clusterType: "country_cluster",
  ...overrides,
});

it("내용이 모두 같으면 이전 배열을 그대로 돌려준다", () => {
  const previous = [makeCluster()];
  const next = [makeCluster({ items: [city] })];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("화면 계산용 필드만 다르면 같은 내용으로 본다", () => {
  const previous = [{ ...makeCluster(), screenPos: { x: 1, y: 2 }, width: 10, effectiveWidth: 5 }];
  const next = [{ ...makeCluster(), screenPos: { x: 3, y: 4 }, width: 12, effectiveWidth: 6 }];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("일부만 바뀌면 같은 클러스터 객체만 재사용하고 새 배열을 돌려준다", () => {
  const unchanged = makeCluster();
  const previous = [unchanged, makeCluster({ id: "country_JPN", name: "일본" })];
  const next = [makeCluster(), makeCluster({ id: "country_JPN", name: "일본", lat: 36 })];

  const result = reuseClusters(previous, next);

  expect(result).not.toBe(previous);
  expect(result[0]).toBe(unchanged);
  expect(result[1]).toBe(next[1]);
});

it("개수나 순서가 달라지면 새 배열을 돌려준다", () => {
  const a = makeCluster();
  const b = makeCluster({ id: "country_JPN", name: "일본" });

  expect(reuseClusters([a, b], [b, a])).not.toEqual([a, b]);
  expect(reuseClusters([a, b], [makeCluster()])).toHaveLength(1);
});

it("items 내용이 같으면 새 객체여도 같은 내용으로 본다", () => {
  const previous = [makeCluster()];
  const next = [makeCluster({ items: [{ ...city }] })];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("items 내용이 바뀌면 다른 내용으로 본다", () => {
  const previous = [makeCluster()];
  const next = [makeCluster({ items: [{ ...city, name: "부산" }] })];

  expect(reuseClusters(previous, next)[0]).toBe(next[0]);
});

it("three-globe가 붙이는 __threeObjHtml 필드가 있어도 같은 내용으로 본다", () => {
  const previous = [{ ...makeCluster(), __threeObjHtml: {} }];
  const next = [makeCluster()];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("빈 배열은 이전 빈 배열을 그대로 돌려준다", () => {
  const previous: ClusterData[] = [];

  expect(reuseClusters(previous, [])).toBe(previous);
});

it("NaN 좌표가 반복돼도 같은 내용으로 본다", () => {
  const previous = [makeCluster({ lat: Number.NaN })];
  const next = [makeCluster({ lat: Number.NaN })];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("thumbnails 배열은 서로 다른 배열이어도 같은 문자열이면 같은 내용으로 본다", () => {
  const previous = [makeCluster({ items: [{ ...city, thumbnails: ["a.jpg", "b.jpg"] }] })];
  const next = [makeCluster({ items: [{ ...city, thumbnails: ["a.jpg", "b.jpg"] }] })];

  expect(reuseClusters(previous, next)).toBe(previous);
});

it("thumbnails 문자열이 다르면 다른 내용으로 본다", () => {
  const previous = [makeCluster({ items: [{ ...city, thumbnails: ["a.jpg"] }] })];
  const next = [makeCluster({ items: [{ ...city, thumbnails: ["c.jpg"] }] })];

  expect(reuseClusters(previous, next)[0]).toBe(next[0]);
});
