import { useCallback, useEffect, useRef, useState } from "react";

import { env } from "@/config/env";

type UseGoogleMapsScriptOptions = {
  apiKey?: string;
  libraries?: string[];
  language?: string;
  region?: string;
};

type ScriptStatus = "idle" | "loading" | "ready" | "error";

const SCRIPT_ID = "google-maps-script";
// 기본값을 렌더마다 새 배열로 만들면 load가 매번 바뀌어, load에 의존하는 effect가 계속 다시 실행된다
const DEFAULT_LIBRARIES = ["places"];
const LOAD_ERROR_MESSAGE = "Google Maps 스크립트 로드에 실패했습니다. 창을 닫고 다시 열어 주세요.";

export const useGoogleMapsScript = ({
  apiKey = env.GOOGLE_MAPS_API_KEY,
  libraries = DEFAULT_LIBRARIES,
  language = "ko",
  region = "KR",
}: UseGoogleMapsScriptOptions = {}) => {
  const [status, setStatus] = useState<ScriptStatus>(() => {
    if (typeof window === "undefined") {
      return "idle";
    }
    return window.google?.maps?.places ? "ready" : "idle";
  });
  const [error, setError] = useState<Error | null>(null);
  const resolveHandlersRef = useRef<(() => void)[]>([]);

  const handleReady = useCallback(() => {
    setStatus("ready");
    setError(null);
    resolveHandlersRef.current.forEach(handler => {
      handler();
    });
    resolveHandlersRef.current = [];
  }, []);

  // 실패한 script 태그가 남아 있으면 다음 load()가 이미 지나간 이벤트만 기다리게 되므로 지워서 새로 받게 한다
  const handleLoadError = useCallback((script: HTMLScriptElement) => {
    script.remove();
    setStatus("error");
    setError(new Error(LOAD_ERROR_MESSAGE));
  }, []);

  const load = useCallback(() => {
    if (typeof window === "undefined") {
      setStatus("error");
      setError(new Error("Google Maps 스크립트는 브라우저 환경에서만 로드할 수 있습니다."));
      return;
    }

    if (window.google?.maps?.places) {
      handleReady();
      return;
    }

    if (!apiKey) {
      setStatus("error");
      setError(new Error("환경 변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 설정되지 않았습니다."));
      return;
    }

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.getAttribute("data-google-maps-loaded") === "true" || window.google?.maps?.places) {
        handleReady();
        return;
      }

      setStatus("loading");
      setError(null);
      const handleLoad = () => {
        existingScript.setAttribute("data-google-maps-loaded", "true");
        existingScript.removeAttribute("data-google-maps-loading");
        handleReady();
      };
      const handleError = () => handleLoadError(existingScript);
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    const librariesParam = libraries.length > 0 ? `&libraries=${libraries.join(",")}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${librariesParam}&language=${language}&region=${region}&loading=async`;
    script.async = true;
    script.defer = true;

    script.setAttribute("data-google-maps-loading", "true");
    script.onload = () => {
      script.setAttribute("data-google-maps-loaded", "true");
      script.removeAttribute("data-google-maps-loading");
      handleReady();
    };
    script.onerror = () => handleLoadError(script);

    setStatus("loading");
    setError(null);
    document.head.appendChild(script);
  }, [apiKey, handleLoadError, handleReady, language, libraries, region]);

  useEffect(() => {
    if (status === "ready" && typeof window !== "undefined" && window.google?.maps?.places) {
      handleReady();
    }
  }, [handleReady, status]);

  const waitUntilReady = useCallback(() => {
    if (status === "ready") {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      if (status === "error") {
        if (error) {
          reject(error);
        } else {
          reject(new Error("Google Maps 스크립트 로드에 실패했습니다."));
        }
        return;
      }

      resolveHandlersRef.current.push(resolve);
      if (status === "idle") {
        load();
      }
    });
  }, [error, load, status]);

  return {
    isReady: status === "ready",
    isLoading: status === "loading",
    status,
    error,
    load,
    waitUntilReady,
  };
};
