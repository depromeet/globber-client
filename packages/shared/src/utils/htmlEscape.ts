/**
 * @file htmlEscape.ts
 * @description HTML 특수문자 이스케이프 유틸리티
 * @responsibility XSS 방지를 위한 동적 문자열 새니타이징
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

/**
 * HTML 컨텍스트에 삽입되는 문자열의 특수문자를 이스케이프합니다.
 * 텍스트 노드와 속성 값 모두에 안전하게 사용할 수 있습니다.
 *
 * @param value - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ESCAPE_MAP[char] ?? char);
