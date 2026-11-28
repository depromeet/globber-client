type BackRouter = {
  back: () => void;
  push: (href: string) => void;
};

/** 이 탭에서 앱 안 화면 이동이 한 번이라도 있었는지 기록하는 sessionStorage 키 */
const IN_APP_NAVIGATION_KEY = "globber:in-app-navigated";

/**
 * 앱 안에서 화면을 이동했다고 기록함
 * 새 탭은 sessionStorage가 비어 있어, 바로 들어온 화면과 앱 안에서 이동해 온 화면을 구분할 수 있음
 */
export const markInAppNavigation = () => {
  try {
    window.sessionStorage.setItem(IN_APP_NAVIGATION_KEY, "1");
  } catch {
    // 시크릿 모드 등에서 저장소를 쓸 수 없으면 기록하지 않음 (뒤로가기는 기본 경로로 감)
  }
};

/**
 * 이 탭에서 앱 안 화면 이동이 있었는지 확인함
 * @returns 이동 기록이 있으면 true
 */
export const hasInAppNavigation = (): boolean => {
  try {
    return window.sessionStorage.getItem(IN_APP_NAVIGATION_KEY) === "1";
  } catch {
    return false;
  }
};

/** 앱 안 이동으로 만들어진 history 항목에 남기는 history.state 키 */
const ENTRY_IN_APP_KEY = "globberInApp";

/**
 * 현재 history 항목이 앱 안 이동으로 만들어졌다고 표시함
 * sessionStorage 기록은 탭 전체의 이력이라 현재 항목이 앱 안에서 생겼는지는 알 수 없으므로, 항목 자체에 표시를 남김
 */
export const markCurrentHistoryEntryInApp = () => {
  try {
    window.history.replaceState({ ...window.history.state, [ENTRY_IN_APP_KEY]: true }, "");
  } catch {
    // history를 쓸 수 없으면 표시하지 않음 (뒤로가기는 기본 경로로 감)
  }
};

/**
 * 현재 history 항목이 앱 안 이동으로 만들어졌는지 확인함
 * @returns 앱 안 이동으로 만들어진 항목이면 true, 직접 진입한 항목이면 false
 */
export const isCurrentHistoryEntryInApp = (): boolean => {
  try {
    return window.history.state?.[ENTRY_IN_APP_KEY] === true;
  } catch {
    return false;
  }
};

/**
 * 앱 안에서 이동해 온 화면이면 뒤로 가고, 새 탭·링크로 바로 들어온 화면이면 기본 경로로 이동함 (GLB-239)
 * 새 탭은 빈 페이지 기록이 있어 history.length로는 바로 들어온 경우를 구분할 수 없음
 * @param router - next/navigation의 router
 * @param fallbackHref - 앱 안 이동 기록이 없을 때 이동할 경로
 */
export const goBackOrFallback = (router: BackRouter, fallbackHref: string) => {
  if (hasInAppNavigation()) {
    router.back();
    return;
  }
  router.push(fallbackHref);
};
