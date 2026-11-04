"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Continent, RecordResponse } from "@globber/shared/types/record";
import { sendGAEvent } from "@next/third-parties/google";

import { Header } from "@/components/common/Header";
import { getAuthInfo } from "@/utils/cookies";

import { RecordContent } from "./RecordContent";

interface RecordClientProps {
  initialData: RecordResponse | null;
}

export function RecordClient({ initialData }: RecordClientProps) {
  const router = useRouter();
  const [selectedContinent, setSelectedContinent] = useState<Continent>("전체");
  const hasViewedRef = useRef(false);

  // editor_record_view / editor_record_exit
  useEffect(() => {
    hasViewedRef.current = true;
    sendGAEvent("event", "editor_record_view", {
      flow: "editor",
      screen: "record",
    });

    return () => {
      if (hasViewedRef.current) {
        sendGAEvent("event", "editor_record_exit", {
          flow: "editor",
          screen: "record",
        });
      }
    };
  }, []);

  // 브라우저 뒤로가기 감지
  useEffect(() => {
    const handlePopState = () => {
      const { uuid } = getAuthInfo();
      if (uuid) {
        router.push(`/globe/${uuid}`);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  const handleBackClick = () => {
    const { uuid } = getAuthInfo();
    if (uuid) {
      router.push(`/globe/${uuid}`);
    }
  };

  const handleEditClick = () => {
    sendGAEvent("event", "record_city_manage_entry", {
      flow: "editor",
      screen: "record",
      click_code: "editor.record.header.city_edit",
    });
    router.push("/record/edit");
  };

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-[512px] h-dvh flex flex-col">
        <div className="max-w-[512px] mx-auto w-full shrink-0">
          <Header
            variant="navy"
            leftIcon="back"
            onLeftClick={handleBackClick}
            rightButtonTitle="도시 편집"
            onRightClick={handleEditClick}
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 20,
            }}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">
            <RecordContent
              initialData={initialData}
              selectedContinent={selectedContinent}
              onContinentChange={setSelectedContinent}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
