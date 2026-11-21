import { useCallback, useEffect, useId, useRef } from "react";

/** 작성 화면의 원래 history 항목에 남기는 표시 (값: 화면 인스턴스 id) */
export const LEAVE_BASE_KEY = "globberLeaveBase";
/** 변경 내용이 생기면 원래 항목 위에 하나 더 쌓는 가드 항목 표시 (값: 화면 인스턴스 id) */
export const LEAVE_GUARD_KEY = "globberLeaveGuard";

/** 가드를 걷어 낼 때 history.back을 반복할 최대 횟수 (바텀시트가 남긴 항목 대비, GLB-188) */
const MAX_RELEASE_STEPS = 20;
/** 걷어 내기가 이 시간 안에 끝나지 않으면 실패로 본다 (원래 항목 표시를 잃은 경우 등) */
const RELEASE_TIMEOUT_MS = 1500;

type HistoryState = Record<string, unknown>;

const readState = (state: unknown): HistoryState => (state && typeof state === "object" ? (state as HistoryState) : {});

type UseLeaveGuardParams = {
  /** 도시 정보가 올바른 작성·수정 화면에서만 켠다 */
  enabled: boolean;
  /** 변경 내용이 생겼을 때 true. 이때 처음 가드 항목을 쌓는다 */
  armed: boolean;
  /** 지금 나가면 확인 창을 띄워야 하는지 */
  shouldBlock: () => boolean;
  /** 브라우저 뒤로가기·스와이프로 나가려 할 때 */
  onBlocked: () => void;
};

/**
 * 브라우저 뒤로가기·iOS 스와이프 뒤로가기도 헤더 뒤로가기처럼 확인 창을 띄운다 (GLB-134)
 *
 * - 화면에 들어오면 지금 history 항목(원래 항목)에 표시만 남긴다. 변경 내용이 없으면 history를 건드리지 않는다
 * - 변경 내용이 생기면 같은 주소의 가드 항목을 하나 쌓는다. 뒤로가기가 가드 아래로 내려가면 다시 쌓고 확인 창을 연다
 * - 앱이 직접 이동할 때(헤더 뒤로가기, 저장 후 이동)는 release로 원래 항목까지 돌아간 뒤 이동한다
 */
export const useLeaveGuard = ({ enabled, armed, shouldBlock, onBlocked }: UseLeaveGuardParams) => {
  const instanceId = useId();
  const shouldBlockRef = useRef(shouldBlock);
  const onBlockedRef = useRef(onBlocked);
  const activeRef = useRef(false);
  const releasingRef = useRef(false);

  // 매 렌더의 최신 콜백을 popstate 처리에서 쓰도록 ref에 담는다
  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
    onBlockedRef.current = onBlocked;
  });

  const isOwnGuard = useCallback((state: unknown) => readState(state)[LEAVE_GUARD_KEY] === instanceId, [instanceId]);
  const isOwnBase = useCallback((state: unknown) => readState(state)[LEAVE_BASE_KEY] === instanceId, [instanceId]);

  const pushGuardEntry = useCallback(() => {
    // Next.js 라우터 상태는 그대로 두고 표시만 바꾼다. 바텀시트·원래 항목 표시는 물려받지 않는다
    const { bottomSheetOpen: _bottomSheetOpen, [LEAVE_BASE_KEY]: _base, ...rest } = readState(window.history.state);
    window.history.pushState({ ...rest, [LEAVE_GUARD_KEY]: instanceId }, "");
  }, [instanceId]);

  // 원래 항목 표시: 걷어 낼 때 어디까지 돌아가야 하는지 알기 위함
  useEffect(() => {
    if (!enabled) return;
    const state = readState(window.history.state);
    if (state[LEAVE_BASE_KEY] !== instanceId) {
      window.history.replaceState({ ...state, [LEAVE_BASE_KEY]: instanceId }, "");
    }
  }, [enabled, instanceId]);

  // 변경 내용이 생기면 가드 항목을 쌓고 뒤로가기를 지켜본다
  useEffect(() => {
    if (!enabled || !armed || activeRef.current) return;
    if (!isOwnGuard(window.history.state)) pushGuardEntry();
    activeRef.current = true;
  }, [enabled, armed, isOwnGuard, pushGuardEntry]);

  useEffect(() => {
    if (!enabled) return;
    const handlePopState = (event: PopStateEvent) => {
      if (!activeRef.current || releasingRef.current) return;
      // 가드 위(바텀시트 등)에서 가드로 돌아온 경우
      if (isOwnGuard(event.state)) return;
      // 바텀시트가 쌓은 항목은 바텀시트가 처리한다
      if (readState(event.state).bottomSheetOpen) return;
      if (shouldBlockRef.current()) {
        pushGuardEntry();
        onBlockedRef.current();
        return;
      }
      // 막을 필요가 없어진 뒤의 뒤로가기는 그대로 두고 더 지켜보지 않는다
      activeRef.current = false;
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled, isOwnGuard, pushGuardEntry]);

  /**
   * 앱이 직접 이동하기 전에 가드(와 그 위에 남은 바텀시트 항목)를 걷어 내고 원래 항목으로 돌아간다
   * @returns 원래 항목에 돌아왔거나 걷어 낼 가드가 없으면 true, 돌아오지 못했으면 false(호출부는 replace로 이동)
   */
  const release = useCallback(
    () =>
      new Promise<boolean>(resolve => {
        if (!activeRef.current) {
          resolve(true);
          return;
        }
        activeRef.current = false;
        if (isOwnBase(window.history.state)) {
          resolve(true);
          return;
        }
        releasingRef.current = true;
        let steps = 0;
        let settled = false;

        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          window.removeEventListener("popstate", handleStep);
          releasingRef.current = false;
          resolve(result);
        };

        function handleStep(event: PopStateEvent) {
          steps += 1;
          if (isOwnBase(event.state)) {
            finish(true);
            return;
          }
          if (steps >= MAX_RELEASE_STEPS) {
            finish(false);
            return;
          }
          window.history.back();
        }

        const timer = window.setTimeout(() => finish(false), RELEASE_TIMEOUT_MS);
        window.addEventListener("popstate", handleStep);
        window.history.back();
      }),
    [isOwnBase]
  );

  return { release };
};
