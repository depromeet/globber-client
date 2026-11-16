// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "./BottomSheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./Dialog";

afterEach(() => vi.unstubAllGlobals());

describe.each([
  { name: "Dialog", Root: Dialog, Content: DialogContent, Title: DialogTitle },
  { name: "BottomSheet", Root: BottomSheet, Content: BottomSheetContent, Title: BottomSheetTitle },
])("$name 접근성 설명", ({ Root, Content, Title }) => {
  it.each([undefined, null, "기록 삭제 확인"])("설명 %s의 연결을 처리함", async ariaDescription => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          createElement(
            Root,
            { open: true },
            createElement(
              Content,
              ariaDescription === undefined ? {} : { ariaDescription },
              createElement(Title, null, "제목"),
              ariaDescription === null ? createElement(DialogDescription, null, "직접 작성한 설명") : null
            )
          )
        )
      );
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      if (ariaDescription === undefined) {
        expect(dialog?.hasAttribute("aria-describedby")).toBe(false);
        expect(dialog?.querySelector("p")).toBeNull();
      } else {
        const id = dialog?.getAttribute("aria-describedby");
        expect(id).toBeTruthy();
        expect(document.getElementById(id!)?.textContent).toBe(ariaDescription ?? "직접 작성한 설명");
        if (ariaDescription === null) {
          const description = dialog?.querySelector('[data-slot="dialog-description"]');
          expect(description?.id).toBe(id);
          expect(dialog?.querySelectorAll("p")).toHaveLength(1);
        }
      }
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
