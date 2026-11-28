import type { CountryData } from "@globber/shared/types/travelPatterns";
import { describe, expect, it, vi } from "vitest";

import { ZOOM_LEVELS } from "@/constants/clusteringConstants";

import { createZoomChangeHandler, shouldExitCityModeOnZoom } from "./eventHandlers";

type HandlerOptions = {
  mode: string;
  isZoomAnimating?: boolean;
  prevZoom?: number;
  zoomStack?: number[];
};

const setup = ({ mode, isZoomAnimating = false, prevZoom = 1, zoomStack = [] }: HandlerOptions) => {
  const spies = {
    setState: vi.fn(),
    setZoomStack: vi.fn(),
    setSelectionStack: vi.fn(),
    onSnapZoomChange: vi.fn(),
    onSelectedDataChange: vi.fn(),
    onExitCityMode: vi.fn(),
  };
  const handler = createZoomChangeHandler(
    spies.setState,
    spies.setZoomStack,
    spies.setSelectionStack,
    {
      zoomStackRef: { current: zoomStack },
      selectionStackRef: { current: zoomStack.map(() => null as CountryData[] | null) },
      prevZoomRef: { current: prevZoom },
      modeRef: { current: mode },
      isZoomAnimatingRef: { current: isZoomAnimating },
    },
    spies.onSnapZoomChange,
    spies.onSelectedDataChange,
    spies.onExitCityMode
  );
  return { handler, spies };
};

describe("도시 모드 줌아웃 복귀 판단", () => {
  it("돌아가기 버튼을 숨기는 기준값 이상이면 복귀한다", () => {
    expect(shouldExitCityModeOnZoom(ZOOM_LEVELS.ZOOM_THRESHOLD, false)).toBe(true);
    expect(shouldExitCityModeOnZoom(ZOOM_LEVELS.DEFAULT, false)).toBe(true);
  });

  it("기준값보다 가까우면 도시 모드를 유지한다", () => {
    expect(shouldExitCityModeOnZoom(ZOOM_LEVELS.ZOOM_THRESHOLD - 0.01, false)).toBe(false);
  });

  it("도시 모드 진입 애니메이션 중에는 기준값 이상이어도 복귀하지 않는다", () => {
    expect(shouldExitCityModeOnZoom(ZOOM_LEVELS.DEFAULT, true)).toBe(false);
  });
});

describe("줌 변경 핸들러", () => {
  it("도시 모드에서 기준값 이상으로 줌아웃하면 국가 모드 복귀 함수만 호출한다", () => {
    const { handler, spies } = setup({ mode: "city", zoomStack: [ZOOM_LEVELS.DEFAULT] });
    expect(handler(ZOOM_LEVELS.ZOOM_THRESHOLD)).toEqual({ exitedCityMode: true, newZoom: ZOOM_LEVELS.ZOOM_THRESHOLD });
    expect(spies.onExitCityMode).toHaveBeenCalledTimes(1);
    expect(spies.onSnapZoomChange).not.toHaveBeenCalled();
    expect(spies.setZoomStack).not.toHaveBeenCalled();
  });

  it("도시 모드에서 기준값보다 가까운 줌 변경은 무시한다", () => {
    const { handler, spies } = setup({ mode: "city", zoomStack: [ZOOM_LEVELS.DEFAULT] });
    expect(handler(2)).toEqual({ newZoom: 2 });
    expect(spies.onExitCityMode).not.toHaveBeenCalled();
    expect(spies.onSnapZoomChange).not.toHaveBeenCalled();
  });

  it("도시 모드 진입 애니메이션 중에는 복귀하지 않는다", () => {
    const { handler, spies } = setup({ mode: "city", isZoomAnimating: true });
    handler(ZOOM_LEVELS.DEFAULT);
    expect(spies.onExitCityMode).not.toHaveBeenCalled();
  });

  it("국가 모드의 줌아웃 스냅 복원은 그대로 동작한다", () => {
    const { handler, spies } = setup({ mode: "country", prevZoom: 1, zoomStack: [ZOOM_LEVELS.DEFAULT] });
    expect(handler(ZOOM_LEVELS.ZOOM_THRESHOLD)).toEqual({ snapped: true });
    expect(spies.onSnapZoomChange).toHaveBeenCalledWith(ZOOM_LEVELS.DEFAULT);
    expect(spies.onExitCityMode).not.toHaveBeenCalled();
  });
});
