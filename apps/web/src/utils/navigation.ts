type BackRouter = {
  back: () => void;
  push: (href: string) => void;
};

/**
 * 돌아갈 방문 기록이 있으면 뒤로 가고, 새 탭·링크로 바로 들어와 기록이 없으면 기본 경로로 이동함 (GLB-239)
 * @param router - next/navigation의 router
 * @param fallbackHref - 방문 기록이 없을 때 이동할 경로
 */
export const goBackOrFallback = (router: BackRouter, fallbackHref: string) => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallbackHref);
};
