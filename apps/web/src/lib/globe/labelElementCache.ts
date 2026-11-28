/**
 * 라벨 DOM과 클릭 리스너의 수명을 관리한다.
 * @param document - 라벨을 생성할 문서
 * @returns 라벨 조회 및 정리 API
 */
export const createLabelElementCache = (document: Document) => {
  const entries = new Map<
    string,
    {
      element: HTMLDivElement;
      controller: AbortController;
      signature: string;
    }
  >();

  return {
    get: (key: string, signature: string) => {
      const previous = entries.get(key);
      const shouldRender = !previous || previous.signature !== signature;
      if (previous && !shouldRender) {
        return { element: previous.element, signal: previous.controller.signal, shouldRender, isNew: false };
      }
      previous?.controller.abort();
      const entry = {
        element: previous?.element ?? document.createElement("div"),
        controller: new document.defaultView!.AbortController(),
        signature,
      };
      entries.set(key, entry);
      return { element: entry.element, signal: entry.controller.signal, shouldRender, isNew: !previous };
    },
    retain: (keys: ReadonlySet<string>) => {
      entries.forEach((entry, key) => {
        if (keys.has(key)) return;
        entry.controller.abort();
        entries.delete(key);
      });
    },
  };
};
