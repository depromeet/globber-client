import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import type { City } from "@globber/shared/types/city";
import type {
  CreateTravelRecordsResponse,
  GlobeResponse,
  LoginResult,
  LoginResultResponse,
  MemberTravelsResponse,
  TravelInsightResponse,
} from "@globber/shared/types/member";
import type { RecordResponse } from "@globber/shared/types/record";
import { convertCitiesToTravelRecords } from "@globber/shared/utils/travelUtils";

import { AUTH_COOKIE } from "@/constants/authCookies";
import { apiDelete, ApiError, apiGet, apiPost, REQUEST_TIMEOUT_STATUS } from "@/lib/apiClient";
import { getAuthInfo } from "@/utils/cookies";

// 로그인 결과 받기 API: 로그인 성공 리다이렉트의 일회용 code(60초, 한 번만 사용)를 토큰·회원 정보로 교환한다
export const exchangeLoginCode = async (code: string): Promise<LoginResult> => {
  try {
    const data = await apiPost<LoginResultResponse>("/auth/token", { code });
    return data.data;
  } catch (error) {
    console.error("Failed to exchange login code:", error);
    throw error;
  }
};

// 멤버 여행 데이터 조회 API
export const getMemberTravels = async (token?: string): Promise<MemberTravelsResponse | null> => {
  try {
    // 서버 컴포넌트에서 호출 시 token을 파라미터로 전달
    let authToken = token;

    // 클라이언트 컴포넌트에서 호출 시 쿠키에서 토큰 가져오기
    if (!authToken) {
      const { token: clientToken } = getAuthInfo();
      authToken = clientToken || undefined;
    }

    if (!authToken) throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
    const data = await apiGet<MemberTravelsResponse>(`/api/v1/member-travels`, {}, authToken);
    return data;
  } catch (error) {
    // 서버 사이드에서 401/500 에러와 제한 시간 초과(408)는 다시 throw (error.tsx에서 처리)
    if (typeof window === "undefined" && error instanceof ApiError) {
      if (error.status === 401 || error.status === REQUEST_TIMEOUT_STATUS || error.status >= 500) {
        throw error;
      }
    }

    // 클라이언트 사이드 또는 502, 503 같은 서버 에러인 경우 조용히 처리
    if (error instanceof ApiError && error.status >= 500 && error.status < 600) {
      return null;
    }
    console.error("Failed to fetch member travels:", error);
    return null;
  }
};

// 멤버 여행 기록 생성 API
export const createMemberTravels = async (cities: City[]): Promise<CreateTravelRecordsResponse> => {
  try {
    const { token } = getAuthInfo();

    if (!token) {
      throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
    }

    const travelRecords = convertCitiesToTravelRecords(cities);
    const data = await apiPost<CreateTravelRecordsResponse>(`/api/v1/member-travels`, travelRecords, token);

    return data;
  } catch (error) {
    console.error("Failed to create member travels:", error);
    throw error;
  }
};

// 지구본 조회 API
type ClientRequestOptions = {
  /** 5xx에서 오류 화면으로 이동하지 않고 null/빈 값을 돌려받아 화면이 직접 안내한다 */
  skipServerErrorRedirect?: boolean;
};

export const getGlobeData = async (
  uuid: string,
  token?: string,
  useToken = true,
  options?: ClientRequestOptions
): Promise<GlobeResponse | null> => {
  try {
    let authToken = "";

    // useToken이 true인 경우에만 토큰 사용
    if (useToken) {
      authToken = token || "";
      if (!authToken) {
        const { token: clientToken } = getAuthInfo();
        authToken = clientToken || "";
      }
    }

    const data = await apiGet<GlobeResponse>(`/api/v1/globes/${uuid}`, {}, authToken, options);
    return data;
  } catch (error) {
    // 서버 사이드에서 401/500 에러와 제한 시간 초과(408)는 다시 throw (error.tsx에서 처리)
    if (typeof window === "undefined" && error instanceof ApiError) {
      if (error.status === 401 || error.status === REQUEST_TIMEOUT_STATUS || error.status >= 500) {
        throw error;
      }
    }
    console.error("Failed to fetch globe data:", error);
    return null;
  }
};

// AI 인사이트 API
export const getTravelInsight = async (
  memberId: number,
  useToken = true,
  options?: ClientRequestOptions
): Promise<string> => {
  try {
    let authToken = "";

    // useToken이 true인 경우에만 토큰 사용
    if (useToken) {
      const { token } = getAuthInfo();
      if (!token) throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
      authToken = token;
    }

    const data = await apiGet<TravelInsightResponse>(`/api/v1/travel-insights/${memberId}`, {}, authToken, options);
    return data.data.title;
  } catch (error) {
    // 서버 사이드에서 401/500 에러와 제한 시간 초과(408)는 다시 throw (error.tsx에서 처리)
    if (typeof window === "undefined" && error instanceof ApiError) {
      if (error.status === 401 || error.status === REQUEST_TIMEOUT_STATUS || error.status >= 500) {
        throw error;
      }
    }
    console.error("Failed to fetch travel insight:", error);
    return "";
  }
};

// 여행지 삭제 API: 내 여행지에서 cityId 도시를 뺀다. 성공하면 204(본문 없음), 내 여행지가 아니면 404
export const deleteMemberTravel = async (cityId: number, token?: string): Promise<void> => {
  try {
    let authToken = token;

    // 클라이언트 컴포넌트에서 호출 시 쿠키에서 토큰 가져오기
    if (!authToken) {
      const { token: clientToken } = getAuthInfo();
      authToken = clientToken || undefined;
    }

    if (!authToken) {
      throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
    }

    await apiDelete<void>(`/api/v1/member-travels/${cityId}`, undefined, authToken);
  } catch (error) {
    console.error("Failed to delete member travel:", error);
    throw error;
  }
};

// 여행 기록 조회 API
export const getRecordData = async (serverCookies?: ReadonlyRequestCookies): Promise<RecordResponse | null> => {
  try {
    let token: string | undefined;
    let memberId: string | undefined;

    // 서버 컴포넌트에서 호출 시 cookies 객체 사용
    if (serverCookies) {
      token = serverCookies.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;
      memberId = serverCookies.get(AUTH_COOKIE.MEMBER_ID)?.value;
    } else {
      // 클라이언트 컴포넌트에서 호출 시 기존 방식 사용
      const authInfo = getAuthInfo();
      token = authInfo.token || undefined;
      memberId = authInfo.memberId || undefined;
    }

    if (!token || !memberId) {
      throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
    }

    const data = await apiGet<RecordResponse>(`/api/v1/member-travels/${memberId}/records`, {}, token);
    return data;
  } catch (error) {
    // 서버 사이드에서 401/500 에러와 제한 시간 초과(408)는 다시 throw (error.tsx에서 처리)
    if (typeof window === "undefined" && error instanceof ApiError) {
      if (error.status === 401 || error.status === REQUEST_TIMEOUT_STATUS || error.status >= 500) {
        throw error;
      }
    }

    // 404 에러인 경우 조용히 처리 (레코드가 없는 경우일 수 있음)
    if (error instanceof ApiError && error.status === 404) {
      console.log("No record data found for member");
      return null;
    }
    console.error("Failed to fetch record data:", error);
    return null;
  }
};
