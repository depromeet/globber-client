"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import type { Emoji } from "@globber/shared/types/emoji";
import { buildErrorPagePath } from "@globber/shared/utils/errorType";
import { sendGAEvent } from "@next/third-parties/google";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme } from "emoji-picker-react";
import { AnimatePresence, motion } from "motion/react";

import { AddEmojiIcon, EmojiHintIcon } from "@/assets/icons";
import { HeadlessToast } from "@/components/common/Toast";
import { usePressEmojiMutation, useRegisterEmojiMutation } from "@/hooks/mutation/useEmojiMutations";
import { useOwnerToast } from "@/hooks/useOwnerToast";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

type Reaction = Emoji;

type FloatingEmoji = {
  id: string;
  emoji: string;
  x: number;
  y: number;
};

type RecordReactionsProps = {
  recordId: string;
  initialReactions?: Reaction[];
  isOwner?: boolean;
};

const MAX_EMPTY_SLOTS = 4;

export const RecordReactions = ({ recordId, initialReactions = [], isOwner = false }: RecordReactionsProps) => {
  const router = useRouter();
  const { mutateAsync: pressEmoji } = usePressEmojiMutation();
  const { mutateAsync: registerEmoji } = useRegisterEmojiMutation();
  const buildInitialReactions = (sourceReactions: Reaction[]) => {
    const reactionsWithAdjustedCount = sourceReactions.map(reaction => ({
      ...reaction,
      count: isOwner ? reaction.count : reaction.count + 1,
    }));
    return [...reactionsWithAdjustedCount].sort((a, b) => b.count - a.count);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const baseReactions = useMemo(() => buildInitialReactions(initialReactions), [initialReactions, isOwner]);
  const [localReactions, setLocalReactions] = useState<Reaction[] | null>(null);
  const reactions = localReactions ?? baseReactions;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const { showToast, toastMessage, setShowToast, showOwnerToast } = useOwnerToast();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const reactionsContainerRef = useRef<HTMLDivElement>(null);
  const attemptCountRef = useRef(0);

  // Cleanup: 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
      timersRef.current.forEach(timer => {
        clearTimeout(timer);
      });
      timersRef.current = [];
    };
  }, []);

  // 키보드 높이 감지 (안드로이드 대응)
  useEffect(() => {
    if (!showEmojiPicker) {
      setKeyboardHeight(0);
      return;
    }

    // Visual Viewport API로 키보드 높이 감지
    const handleResize = () => {
      if (typeof window === "undefined" || !window.visualViewport) return;

      const visualViewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const calculatedKeyboardHeight = windowHeight - visualViewportHeight;

      // 키보드가 실제로 나타났을 때만 업데이트 (50px 이상)
      if (calculatedKeyboardHeight > 50) {
        setKeyboardHeight(calculatedKeyboardHeight);
      } else {
        setKeyboardHeight(0);
      }
    };

    // 피커가 열릴 때 약간의 딜레이 후 초기 높이 계산
    const initialTimer = setTimeout(handleResize, 100);

    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(initialTimer);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [showEmojiPicker]);

  const handleErrorAlert = (errorMessage: string) => {
    const is401Error =
      errorMessage.includes("401") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("인증");

    if (is401Error) {
      if (window.confirm(errorMessage)) {
        router.push(buildErrorPagePath("401"));
      }
    } else {
      alert(errorMessage);
    }
  };

  const createFloatingEmojiWithRect = (emoji: string, rect: DOMRect) => {
    // SSR 환경에서 실행되지 않도록 확인
    if (typeof window === "undefined") {
      return;
    }

    // 이미 애니메이션이 진행 중이면 무시
    if (isAnimatingRef.current) {
      return;
    }

    isAnimatingRef.current = true;

    // 여러 개의 이모지를 연속으로 생성 (3-5개)
    const emojiCount = Math.floor(Math.random() * 3) + 3;
    const localTimers: NodeJS.Timeout[] = [];

    for (let i = 0; i < emojiCount; i++) {
      const createTimer = setTimeout(() => {
        const randomX = (Math.random() - 0.5) * 60;

        // Portal을 사용하므로 fixed position은 뷰포트 기준
        // rect는 이미 뷰포트 기준 좌표
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const scaledX = centerX + randomX;
        const scaledY = centerY;

        // viewport 기준 절대 좌표 (fixed position 사용)
        const floatingEmoji: FloatingEmoji = {
          id: `${Date.now()}-${Math.random()}`,
          emoji,
          x: scaledX,
          y: scaledY,
        };

        setFloatingEmojis(prev => [...prev, floatingEmoji]);

        const removeTimer = setTimeout(() => {
          setFloatingEmojis(prev => prev.filter(e => e.id !== floatingEmoji.id));
        }, 2000);

        timersRef.current.push(removeTimer);
        localTimers.push(removeTimer);
      }, i * 150);

      timersRef.current.push(createTimer);
      localTimers.push(createTimer);
    }

    // 애니메이션이 끝난 후 다시 클릭 가능하도록
    const animationEndTimer = setTimeout(
      () => {
        isAnimatingRef.current = false;
      },
      emojiCount * 150 + 300
    );

    timersRef.current.push(animationEndTimer);
    localTimers.push(animationEndTimer);
  };

  const handleReactionScroll = () => {
    if (isOwner) return;

    if (scrollDebounceTimerRef.current) {
      clearTimeout(scrollDebounceTimerRef.current);
    }

    scrollDebounceTimerRef.current = setTimeout(() => {
      const container = reactionsContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const buttons = container.querySelectorAll("button[data-emoji-code]");

      let visibleStart = -1;
      let visibleEnd = -1;

      buttons.forEach((btn, index) => {
        const btnRect = btn.getBoundingClientRect();
        const isVisible = btnRect.right > containerRect.left && btnRect.left < containerRect.right;
        if (isVisible) {
          if (visibleStart === -1) visibleStart = index;
          visibleEnd = index;
        }
      });

      if (visibleStart === -1) return;

      sendGAEvent("event", "endview_other_reaction_horizontal_scroll", {
        flow: "endview",
        screen: "other",
        click_code: "endview.other.reaction.horizontal_swipe",
        record_id: recordId,
        visible_index_start: visibleStart,
        visible_index_end: visibleEnd,
        total_reaction_type_count: reactions.length,
      });
    }, 300);
  };

  const sendReactionAddEvent = (glyph: string, currentReactionCount: number) => {
    const screen = isOwner ? "my" : "other";
    sendGAEvent("event", isOwner ? "endview_my_reaction_add" : "endview_other_reaction_add", {
      flow: "endview",
      screen,
      click_code: `endview.${screen}.reaction.add`,
      record_id: recordId,
      emoji_type: glyph,
      current_reaction_count: currentReactionCount,
    });
  };

  const handleReactionClick = async (reactionCode: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const reaction = reactions.find(({ code }) => code === reactionCode);
    if (!reaction) return;

    const screen = isOwner ? "my" : "other";
    sendGAEvent("event", isOwner ? "endview_my_reaction_attempt" : "endview_other_reaction_item_click", {
      flow: "endview",
      screen,
      click_code: `endview.${screen}.reaction.item`,
      record_id: recordId,
      emoji_type: reaction.glyph,
      ...(isOwner ? { attempt_count: ++attemptCountRef.current } : { current_reaction_count: reaction.count + 1 }),
    });

    if (isOwner) {
      showOwnerToast("친구들만 이모지를 눌러줄 수 있어요!");
      return;
    }

    // 먼저 UI 업데이트 (낙관적 업데이트)
    setLocalReactions(prev => {
      const currentReactions = prev ?? baseReactions;
      const updatedReactions = currentReactions.map(r => (r.code === reactionCode ? { ...r, count: r.count + 1 } : r));
      return updatedReactions;
    });

    // 애니메이션 실행 - 버튼 위치를 미리 저장
    const buttonElement = event.currentTarget;
    const rect = buttonElement.getBoundingClientRect();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      createFloatingEmojiWithRect(reaction.glyph, rect);
    }, 100);

    try {
      await pressEmoji({
        diaryId: recordId,
        code: reactionCode,
      });
    } catch (error) {
      // owner가 아닐 때만 롤백 처리
      setLocalReactions(prev => {
        const currentReactions = prev ?? baseReactions;
        const rolledBackReactions = currentReactions.map(r =>
          r.code === reactionCode ? { ...r, count: r.count - 1 } : r
        );
        return rolledBackReactions;
      });

      const errorMessage = error instanceof Error ? error.message : "이모지 누르기에 실패했습니다";
      handleErrorAlert(errorMessage);
    }
  };

  const handleEmojiSelect = async (emojiData: EmojiClickData) => {
    const { emoji: glyph, unified: code } = emojiData;

    try {
      // API 호출
      await registerEmoji({
        diaryId: recordId,
        code,
        glyph,
      });

      // 성공 시 로컬 상태 업데이트
      const existingAtAdd = (localReactions ?? baseReactions).find(r => r.glyph === glyph);
      sendReactionAddEvent(glyph, existingAtAdd ? reactions.length : reactions.length + 1);

      setLocalReactions(prev => {
        const currentReactions = prev ?? baseReactions;
        const existingReaction = currentReactions.find(r => r.glyph === glyph);

        // owner가 아닐 때만 카운트 증가, owner는 카운트 0으로 추가
        if (existingReaction) {
          const updatedReactions = currentReactions.map(r =>
            r.glyph === glyph ? { ...r, count: isOwner ? r.count : r.count + 1 } : r
          );

          const clickedReaction = updatedReactions.find(r => r.glyph === glyph);
          const otherReactions = updatedReactions.filter(r => r.glyph !== glyph);
          const newOrder = clickedReaction ? [clickedReaction, ...otherReactions] : updatedReactions;

          return newOrder;
        }

        const newReaction: Reaction = {
          code,
          glyph,
          count: isOwner ? 0 : 1,
        };

        const newReactions = [newReaction, ...currentReactions];
        return newReactions;
      });

      setShowEmojiPicker(false);
    } catch (error) {
      // "이미 등록된 이모지" 에러인 경우, 기존 이모지의 카운트를 +1
      const errorMessage = error instanceof Error ? error.message : "이모지 등록에 실패했습니다";
      const isDuplicateError = errorMessage.includes("already") || errorMessage.includes("이미");

      if (isDuplicateError) {
        // owner일 때: Toast 표시
        if (isOwner) {
          showOwnerToast("이미 등록된 이모지입니다.");
          setShowEmojiPicker(false);
          return;
        }

        // owner가 아닐 때: 카운트 증가 및 애니메이션 실행
        try {
          // 이미 등록된 이모지이므로 pressEmoji를 호출하여 카운트 증가
          await pressEmoji({
            diaryId: recordId,
            code,
          });

          sendReactionAddEvent(glyph, reactions.length);

          // 성공 시 로컬 상태 업데이트
          setLocalReactions(prev => {
            const currentReactions = prev ?? baseReactions;
            const existingReaction = currentReactions.find(r => r.glyph === glyph);

            if (existingReaction) {
              const updatedReactions = currentReactions.map(r =>
                r.glyph === glyph ? { ...r, count: r.count + 1 } : r
              );

              const clickedReaction = updatedReactions.find(r => r.glyph === glyph);
              const otherReactions = updatedReactions.filter(r => r.glyph !== glyph);
              const newOrder = clickedReaction ? [clickedReaction, ...otherReactions] : updatedReactions;

              return newOrder;
            }

            return currentReactions;
          });

          // 애니메이션 실행 - 해당 이모지 버튼 찾기
          const reactionButton = reactionsContainerRef.current?.querySelector(
            `button[data-emoji-code="${code}"]`
          ) as HTMLButtonElement;

          if (reactionButton) {
            const rect = reactionButton.getBoundingClientRect();
            createFloatingEmojiWithRect(glyph, rect);
          }

          setShowEmojiPicker(false);
        } catch (pressError) {
          const pressErrorMessage = pressError instanceof Error ? pressError.message : "이모지 처리에 실패했습니다";
          handleErrorAlert(pressErrorMessage);
        }
      } else {
        handleErrorAlert(errorMessage);
      }
    }
  };

  const handleAddEmoji = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowEmojiPicker(true);
  };

  const emptySlots = Math.max(0, MAX_EMPTY_SLOTS - reactions.length);
  const hasEmptySlots = reactions.length < MAX_EMPTY_SLOTS;
  const canInteract = !isOwner;

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  return (
    <div>
      <div className="flex items-center gap-4 relative">
        <button
          type="button"
          onClick={handleAddEmoji}
          className="w-[68px] h-[68px] rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-[0px_4px_30px_0px_rgba(0,0,0,0.25)]"
          style={{
            background:
              "radial-gradient(circle at 17.15% 14.06%, #00d9ff 0%, #0cdaff 7.02%, #18ddff 14.04%, #30e0ff 28.07%, #48e4ff 42.11%, #60e7ff 56.15%, #93efff 78.07%, #c6f6ff 100%)",
          }}
          aria-label="이모지 추가"
        >
          <AddEmojiIcon />
        </button>

        {/* 그라디언트 오버레이 - 좌측 페이드 효과 */}
        <div
          className="absolute left-[68px] top-0 bottom-0 w-20 pointer-events-none z-10"
          style={{
            background: "linear-gradient(90deg, #001326 0%, rgba(0, 19, 38, 0) 81.63%)",
          }}
        />

        <div
          ref={reactionsContainerRef}
          className="flex items-center gap-4 overflow-x-auto scrollbar-hide flex-1 p-2 pl-0"
          onScroll={handleReactionScroll}
        >
          {reactions.map(({ code, glyph, count }, index) => (
            <motion.button
              key={`${code}-${glyph}-${index}`}
              type="button"
              data-emoji-code={code}
              onClick={e => handleReactionClick(code, e)}
              whileTap={canInteract ? { scale: 0.85 } : {}}
              whileHover={canInteract ? { scale: 1.05 } : {}}
              className="w-[66px] h-[66px] rounded-full flex flex-col items-center justify-center gap-0.5 shrink-0"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.04) 100%), linear-gradient(90deg, rgba(14, 23, 36, 0.87) 0%, rgba(14, 23, 36, 0.87) 100%)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <span className="text-[20px] leading-none tracking-[-0.8px]">{glyph}</span>
              <span className="text-[12px] font-semibold text-white leading-normal tracking-[-0.48px]">{count}</span>
            </motion.button>
          ))}

          {hasEmptySlots &&
            Array.from({ length: emptySlots }, (_, i) => `empty-${reactions.length + i}`).map(uniqueKey => (
              <button
                key={uniqueKey}
                type="button"
                onClick={e => handleAddEmoji(e)}
                className="w-[66px] h-[66px] rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.04) 100%), linear-gradient(90deg, rgba(14, 23, 36, 0.87) 0%, rgba(14, 23, 36, 0.87) 100%)",
                }}
                aria-label="이모지 추가"
              >
                <EmojiHintIcon />
              </button>
            ))}
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {floatingEmojis.map(floatingEmoji => (
                <motion.div
                  key={floatingEmoji.id}
                  className="fixed pointer-events-none z-40 text-5xl drop-shadow-lg"
                  style={{
                    left: `${floatingEmoji.x}px`,
                    top: `${floatingEmoji.y}px`,
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                  }}
                  initial={{
                    opacity: 0,
                    scale: 0.3,
                    y: 0,
                  }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0.2, 0.5, 1, 0.8],
                    y: -200,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  transition={{
                    duration: 2,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    times: [0, 0.15, 0.85, 1],
                  }}
                >
                  {floatingEmoji.emoji}
                </motion.div>
              ))}
            </AnimatePresence>,
            document.body
          )}

        {showEmojiPicker &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setShowEmojiPicker(false)}
                onKeyDown={e => {
                  if (e.key === "Escape") setShowEmojiPicker(false);
                }}
                aria-label="이모지 피커 닫기"
              />
              <div
                className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto rounded-t-3xl bg-[#0E1724] overflow-hidden"
                style={{
                  paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : "env(safe-area-inset-bottom)",
                }}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width="100%"
                  height="354px"
                  theme={Theme.DARK}
                  searchPlaceHolder="이모지를 검색해 보세요"
                  previewConfig={{
                    showPreview: false,
                  }}
                  autoFocusSearch={false}
                  skinTonesDisabled
                />
              </div>
            </>,
            document.body
          )}

        {/* Toast 알림 - owner가 클릭했을 때 */}
        <HeadlessToast
          open={showToast}
          onOpenChange={setShowToast}
          duration={1500}
          className="backdrop-blur-[25px] backdrop-filter flex items-center gap-4 px-4 py-3.5 rounded-lg"
          contentClassName="text-sm font-medium text-white text-center text-nowrap"
        >
          {toastMessage}
        </HeadlessToast>
      </div>
    </div>
  );
};
