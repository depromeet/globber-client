import { useCallback, useEffect, useRef } from "react";

/** 기록 작성 화면 위에 하나 더 쌓는 history 항목 표시 */
export const LEAVE_GUARD_KEY = "globberLeaveGuard";

/** 가드 항목 아래로 내려가려고 history.back을 반복할 최대 횟수 (바텀시트가 남긴 항목 대비) */
const MAX_RELEASE_STEPS = 5;

type HistoryState = Record<string, unknown> | null;

const readState = (state: unknown): HistoryState =>
  state && typeof state === "object" ? (state as Record<string, unknown>) : null;

const isGuardState = (state: unknown) => readState(state)?.[LEAVE_GUARD_KEY] === true;

const pushGuardEntry = () => {
  // Next.js 라우터 상태는 그대로 두고 표시만 더한다. 바텀시트 표시는 물려받지 않는다
  const { bottomSheetOpen: _bottomSheetOpen, ...rest } = readState(window.history.state) ?? {};
  window.history.pushState({ ...rest, [LEAVE_GUARD_KEY]: true }, "");
};

type UseLeaveGuardParams = {
  /** 가드를 쌓을지 여부 (도시 정보가 올바른 작성·수정 화면에서만) */
  enabled: boolean;
  /** 지금 나가면 확인 창을 띄워야 하는지 */
  shouldBlock: () => boolean;
  /** 브라우저 뒤로가기·스와이프로 나가려 할 때 */
  onBlocked: () => void;
};

/**
 * 브라우저 뒤로가기·iOS 스와이프 뒤로가기도 헤더 뒤로가기처럼 확인 창을 띄운다 (GLB-134)
 *
 * 화면에 들어오면 같은 주소의 history 항목을 하나 더 쌓아 두고, 뒤로가기로 그 아래 항목에 닿으면
 * - 막아야 하면 항목을 다시 쌓고 onBlocked를 부른다
 * - 막지 않아도 되면 한 번 더 뒤로 가서 원래 뒤로가기처럼 이전 화면으로 보낸다
 * 앱이 직접 이동할 때(헤더 뒤로가기, 저장 후 이동)는 release로 가드 항목을 먼저 걷어 낸다
 */
export const useLeaveGuard = ({ enabled, shouldBlock, onBlocked }: UseLeaveGuardParams) => {
  const shouldBlockRef = useRef(shouldBlock);
  const onBlockedRef = useRef(onBlocked);
  // 매 렌더의 최신 콜백을 popstate 처리에서 쓰도록 ref에 담는다
  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
    onBlockedRef.current = onBlocked;
  });

  const releasingRef = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // 개발 모드에서 effect가 두 번 돌아도 가드 항목은 하나만 쌓는다
    if (!isGuardState(window.history.state)) pushGuardEntry();
    activeRef.current = true;

    const handlePopState = (event: PopStateEvent) => {
      if (releasingRef.current) return;
      // 바텀시트 등 가드 위에 쌓인 항목에서 돌아온 경우
      if (isGuardState(event.state)) return;
      // 바텀시트가 남긴 항목으로 돌아온 경우는 바텀시트가 처리한다
      if (readState(event.state)?.bottomSheetOpen) return;

      if (shouldBlockRef.current()) {
        pushGuardEntry();
        onBlockedRef.current();
        return;
      }
      // 확인할 필요가 없으면 가드 항목 때문에 생긴 한 칸을 대신 넘어 원래 뒤로가기처럼 동작한다
      activeRef.current = false;
      window.history.back();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);

  /** 앱이 직접 이동하기 전에 가드 항목(과 그 위에 남은 바텀시트 항목)을 걷어 낸다 */
  const release = useCallback(
    () =>
      new Promise<void>(resolve => {
        if (!activeRef.current) {
          resolve();
          return;
        }
        activeRef.current = false;
        releasingRef.current = true;
        let passedGuard = isGuardState(window.history.state);
        let steps = 0;

        const finish = () => {
          window.removeEventListener("popstate", handleStep);
          releasingRef.current = false;
          resolve();
        };

        function handleStep(event: PopStateEvent) {
          steps += 1;
          if (isGuardState(event.state)) passedGuard = true;
          else if (passedGuard) {
            finish();
            return;
          }
          if (steps >= MAX_RELEASE_STEPS) {
            finish();
            return;
          }
          window.history.back();
        }

        window.addEventListener("popstate", handleStep);
        window.history.back();
      }),
    []
  );

  return { release };
};
