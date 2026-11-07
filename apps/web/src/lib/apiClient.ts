import { buildErrorPagePath, toErrorTypeFromStatus } from "@globber/shared/utils/errorType";

import { env } from "@/config/env";

const API_BASE_URL = env.API_BASE_URL;

const isDev = env.IS_LOCAL_DEV;
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => isDev && console.error(...args),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 요청 제한 시간. 백엔드가 응답하지 않을 때 화면이 멈추지 않도록 이 시간이 지나면 요청을 끊는다 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** 요청 제한 시간을 넘겼을 때 쓰는 상태 코드 (HTTP 408 Request Timeout) */
export const REQUEST_TIMEOUT_STATUS = 408;

type RequestOptions = {
  /** 요청 제한 시간(ms). 기본값은 DEFAULT_REQUEST_TIMEOUT_MS */
  timeoutMs?: number;
};

type RequestTimeout = {
  signal: AbortSignal;
  timeoutMs: number;
  /** 요청이 끝나면 호출해 남은 타이머를 정리한다 */
  clear: () => void;
};

/**
 * 요청 하나에 쓸 제한 시간을 시작합니다. 응답 본문을 다 읽을 때까지 같은 signal을 쓰고, 끝나면 clear로 정리합니다.
 */
const startRequestTimeout = (timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): RequestTimeout => {
  if (typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(timeoutMs), timeoutMs, clear: () => {} };
  }

  // AbortSignal.timeout이 없는 구형 브라우저(iOS 16 미만 등) 대응
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("The operation timed out.", "TimeoutError")),
    timeoutMs
  );
  return { signal: controller.signal, timeoutMs, clear: () => clearTimeout(timer) };
};

/**
 * 이 요청의 제한 시간이 끝나서 난 오류라면 상태 408의 ApiError로 바꿔, 다른 API 오류와 같은 방식으로 처리되게 합니다.
 * 구형 브라우저는 abort 사유와 관계없이 AbortError를 던지므로 AbortError도 함께 보되, 이 요청의 signal이 끝났을 때만 바꿉니다.
 */
const toRequestError = (error: unknown, timeout: RequestTimeout, endpoint: string): unknown => {
  const isAbort = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
  if (isAbort && timeout.signal.aborted) {
    return new ApiError(`Request timed out after ${timeout.timeoutMs}ms`, REQUEST_TIMEOUT_STATUS, endpoint);
  }
  return error;
};

const getDefaultHeaders = () => ({
  accept: "*/*",
  "Content-Type": "application/json",
});

const getAuthHeaders = (token?: string) => ({
  ...getDefaultHeaders(),
  ...(token && { Authorization: `Bearer ${token}` }),
});

const parseJsonSafely = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const bodyText = await response.text();
  if (!bodyText) {
    return undefined as T;
  }

  return JSON.parse(bodyText) as T;
};

/**
 * 클라이언트 사이드에서 401/500 에러를 자동으로 에러 페이지로 리다이렉트합니다.
 * 서버 사이드에서는 에러를 그대로 throw하여 서버 컴포넌트의 error.tsx에서 처리합니다.
 */
const handleGlobalError = (status: number, skipGlobalErrorHandling?: boolean): void => {
  // 전역 에러 처리 스킵 플래그가 있으면 리턴
  if (skipGlobalErrorHandling) return;

  // 클라이언트 사이드에서만 자동 리다이렉트
  if (typeof window === "undefined") return;

  const errorType = toErrorTypeFromStatus(status);

  if (errorType === "401" || errorType === "500") {
    window.location.href = buildErrorPagePath(errorType);
  }
};

export const apiGet = async <T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
  token?: string,
  options?: { skipGlobalErrorHandling?: boolean } & RequestOptions
): Promise<T> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const url = `${API_BASE_URL}${endpoint}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

    logger.log(`[API] GET ${endpoint}`);
    logger.log(`[API] URL:`, url);

    const response = await fetch(url, {
      method: "GET",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      signal: timeout.signal,
    });

    logger.log(`[API] Response status:`, response.status);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response");
      logger.log(`[API] Error response body:`, responseText);
      const apiError = new ApiError(`HTTP error! status: ${response.status}`, response.status, endpoint);

      // 401/500 에러는 전역으로 처리 (클라이언트 사이드에서만 자동 리다이렉트)
      // 서버 사이드에서는 에러를 그대로 throw하여 서버 컴포넌트의 error.tsx에서 처리
      handleGlobalError(response.status, options?.skipGlobalErrorHandling);

      // 404와 5xx 서버 에러를 제외하고만 로그 출력
      if (response.status !== 404 && response.status < 500) {
        logger.error(`API GET Error (${endpoint}):`, apiError);
      }
      throw apiError;
    }

    const data = await parseJsonSafely<T>(response);
    logger.log(`[API] Response data:`, data);
    return data;
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    // ApiError가 아니거나 404와 5xx가 아닌 경우에만 로그 출력
    if (!(requestError instanceof ApiError) || (requestError.status !== 404 && requestError.status < 500)) {
      logger.error(`API GET Error (${endpoint}):`, requestError);
    }
    throw requestError;
  } finally {
    timeout.clear();
  }
};

export const apiPost = async <T>(
  endpoint: string,
  data?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<T> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const requestBody = data ? JSON.stringify(data) : undefined;

    logger.log(`[API] POST ${endpoint}`);
    logger.log(`[API] URL:`, url);
    logger.log(`[API] Request Body:`, requestBody);
    logger.log(`[API] Headers:`, token ? getAuthHeaders(token) : getDefaultHeaders());

    const response = await fetch(url, {
      method: "POST",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      body: requestBody,
      signal: timeout.signal,
    });

    logger.log(`[API] Response status:`, response.status);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response");
      logger.log(`[API] Error response body:`, responseText);

      let errorMessage = `HTTP error! status: ${response.status}`;
      if (responseText) {
        errorMessage += ` - ${responseText}`;
      }
      throw new ApiError(errorMessage, response.status, endpoint);
    }

    const result = await parseJsonSafely<T>(response);
    logger.log(`[API] Response data:`, result);
    return result;
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    logger.error(`API POST Error (${endpoint}):`, requestError);
    throw requestError;
  } finally {
    timeout.clear();
  }
};

/**
 * POST 요청을 보내고 응답 데이터와 함께 헤더도 반환합니다.
 * 백엔드에서 리다이렉트 URL 등을 헤더로 전달할 때 사용합니다.
 */
export const apiPostWithHeaders = async <T>(
  endpoint: string,
  data?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<{ data: T; headers: Headers }> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const requestBody = data ? JSON.stringify(data) : undefined;

    logger.log(`[API] POST ${endpoint}`);
    logger.log(`[API] URL:`, url);
    logger.log(`[API] Request Body:`, requestBody);
    logger.log(`[API] Headers:`, token ? getAuthHeaders(token) : getDefaultHeaders());

    const response = await fetch(url, {
      method: "POST",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      body: requestBody,
      credentials: "include",
      signal: timeout.signal,
    });

    logger.log(`[API] Response status:`, response.status);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response");
      logger.log(`[API] Error response body:`, responseText);

      let errorMessage = `HTTP error! status: ${response.status}`;
      if (responseText) {
        errorMessage += ` - ${responseText}`;
      }
      throw new ApiError(errorMessage, response.status, endpoint);
    }

    const result = await parseJsonSafely<T>(response);
    logger.log(`[API] Response data:`, result);
    logger.log(`[API] Response headers:`, Object.fromEntries(response.headers.entries()));

    return {
      data: result,
      headers: response.headers,
    };
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    logger.error(`API POST Error (${endpoint}):`, requestError);
    throw requestError;
  } finally {
    timeout.clear();
  }
};

export const apiPut = async <T>(
  endpoint: string,
  data?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<T> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      body: data ? JSON.stringify(data) : undefined,
      signal: timeout.signal,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const responseText = await response.text();
        if (responseText) {
          errorMessage += ` - ${responseText}`;
        }
      } catch {
        // 파싱 에러는 무시한다
      }
      throw new ApiError(errorMessage, response.status, endpoint);
    }

    return await parseJsonSafely<T>(response);
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    logger.error(`API PUT Error (${endpoint}):`, requestError);
    throw requestError;
  } finally {
    timeout.clear();
  }
};

export const apiPatch = async <T>(
  endpoint: string,
  data?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<T> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const requestBody = data ? JSON.stringify(data) : undefined;

    logger.log(`[API] PATCH ${endpoint}`);
    logger.log(`[API] URL:`, url);
    logger.log(`[API] Request Body:`, requestBody);
    logger.log(`[API] Headers:`, token ? getAuthHeaders(token) : getDefaultHeaders());

    const response = await fetch(url, {
      method: "PATCH",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      body: requestBody,
      signal: timeout.signal,
    });

    logger.log(`[API] Response status:`, response.status);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response");
      logger.log(`[API] Error response body:`, responseText);

      let errorMessage = `HTTP error! status: ${response.status}`;
      if (responseText) {
        errorMessage += ` - ${responseText}`;
      }
      throw new ApiError(errorMessage, response.status, endpoint);
    }

    const result = await parseJsonSafely<T>(response);
    logger.log(`[API] Response data:`, result);
    return result;
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    logger.error(`API PATCH Error (${endpoint}):`, requestError);
    throw requestError;
  } finally {
    timeout.clear();
  }
};

export const apiDelete = async <T>(
  endpoint: string,
  data?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<T> => {
  const timeout = startRequestTimeout(options?.timeoutMs);
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const requestBody = data ? JSON.stringify(data) : undefined;

    logger.log(`[API] DELETE ${endpoint}`);
    logger.log(`[API] URL:`, url);
    logger.log(`[API] Request Body:`, requestBody);
    logger.log(`[API] Headers:`, token ? getAuthHeaders(token) : getDefaultHeaders());

    const response = await fetch(url, {
      method: "DELETE",
      headers: token ? getAuthHeaders(token) : getDefaultHeaders(),
      body: requestBody,
      signal: timeout.signal,
    });

    logger.log(`[API] Response status:`, response.status);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response");
      logger.log(`[API] Error response body:`, responseText);

      let errorMessage = `HTTP error! status: ${response.status}`;
      if (responseText) {
        errorMessage += ` - ${responseText}`;
      }
      throw new ApiError(errorMessage, response.status, endpoint);
    }

    const result = await parseJsonSafely<T>(response);
    logger.log(`[API] Response data:`, result);
    return result;
  } catch (error) {
    const requestError = toRequestError(error, timeout, endpoint);
    logger.error(`API DELETE Error (${endpoint}):`, requestError);
    throw requestError;
  } finally {
    timeout.clear();
  }
};
