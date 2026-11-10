import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { createLabelElementCache } from "./labelElementCache";

describe("라벨 DOM 캐시", () => {
  it("줌 변경 시 같은 DOM과 썸네일을 재사용한다", () => {
    const document = new JSDOM("", { url: "http://localhost" }).window.document;
    const createElement = vi.spyOn(document, "createElement");
    const cache = createLabelElementCache(document);
    const first = cache.get("country_KR", "서울 사진");
    first.element.innerHTML = '<img src="photo.jpg">';
    const image = first.element.firstChild;
    const next = cache.get("country_KR", "서울 사진");
    expect(next.element).toBe(first.element);
    expect(next.element.firstChild).toBe(image);
    expect(next.shouldRender).toBe(false);
    expect(createElement).toHaveBeenCalledTimes(1);
  });

  it("내용과 클릭 데이터가 변경되면 같은 DOM을 갱신하고 이전 리스너를 해제한다", () => {
    const cache = createLabelElementCache(new JSDOM("", { url: "http://localhost" }).window.document);
    const first = cache.get("city_1", "기록 없음");
    const clicks: string[] = [];
    first.element.addEventListener("click", () => clicks.push("추가"), { signal: first.signal });
    const updated = cache.get("city_1", "기록 있음");
    updated.element.textContent = "새 사진";
    updated.element.addEventListener("click", () => clicks.push("상세"), { signal: updated.signal });
    updated.element.click();
    expect(updated.element).toBe(first.element);
    expect(updated.shouldRender).toBe(true);
    expect(first.element.textContent).toBe("새 사진");
    expect(clicks).toEqual(["상세"]);
  });

  it("사라진 클러스터의 DOM과 리스너를 정리한다", () => {
    const cache = createLabelElementCache(new JSDOM("", { url: "http://localhost" }).window.document);
    const first = cache.get("continent_AS_KR_JP", "아시아");
    cache.retain(new Set(["country_KR"]));
    expect(first.signal.aborted).toBe(true);
    expect(cache.get("continent_AS_KR_JP", "아시아").element).not.toBe(first.element);
  });
});
