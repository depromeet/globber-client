/**
 * API 응답의 공통 인터페이스
 * 모든 API 응답은 이 기본 구조를 따릅니다.
 *
 * @template T - 응답 데이터의 타입
 *
 * @example
 * type UserResponse = ApiResponse<User>;
 */
export interface ApiResponse<T> {
  status: string;
  data: T;
}
