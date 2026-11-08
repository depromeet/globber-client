/**
 * 클러스터 스타일
 * - 대륙 버블: 반투명 배경, 진한 획색 텍스트
 * - 국가 버블: 반투명 배경, 흰색 텍스트, 도시 개수 원형 배지
 */

import { calculateLabelOffset } from "./calculations";

// ============================================
// 공통 헬퍼 함수
// ============================================

/**
 * 중심 dot 스타일 (3개 함수 공통)
 */
const DOT_STYLE = `
  position: absolute;
  top: -3px;
  left: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
  z-index: 6;
  pointer-events: none;
`;

/**
 * 45도 각도 점선 스타일 생성 (3개 함수 공통)
 */
const createHorizontalLineStyle = (lineLength: number, offsetX: number) => `
  position: absolute;
  top: 0px;
  left: 0px;
  width: ${lineLength}px;
  height: 1px;
  transform-origin: 0 0;
  transform: rotate(${offsetX > 0 ? -45 : -135}deg);
  background-image: repeating-linear-gradient(
    to right,
    white 0px,
    white 3px,
    transparent 3px,
    transparent 8px
  );
  z-index: 5;
  pointer-events: none;
`;

// ============================================
// 도시 개별 라벨 스타일
// ============================================

export const createSingleLabelStyles = (
  index: number = 0,
  angleOffset: number = 0,
  distance: number = 50,
  rightPadding: number = 30
) => {
  const { lineLength, offsetX, offsetY } = calculateLabelOffset(angleOffset, distance);

  return {
    dot: DOT_STYLE,
    horizontalLine: createHorizontalLineStyle(lineLength, offsetX),
    label: `
      display: inline-flex;
      padding: 6px ${rightPadding}px 6px 12px;
      align-items: center;
      gap: 5px;
      border-radius: 50px;
      background: white;
      box-shadow: 0 2px 20px 0 rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      color: #1f4263;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 1.5;
      font-feature-settings: 'liga' off, 'clig' off;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      pointer-events: auto;
      position: absolute;
      z-index: ${20 + index};
      top: ${offsetY + 15}px;
      left: ${offsetX}px;
      transform: translate(-50%, -50%);
      white-space: nowrap;
    `,
    actionButton: (leftOffset: number) => `
      position: absolute;
      z-index: ${20 + index + 1};
      top: ${offsetY + 15}px;
      left: ${offsetX + leftOffset}px;
      width: 37px;
      height: 44px;
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: -20px;
      transform: translateY(-50%);
    `,
    thumbnailCard: (leftOffset: number) => `
      position: absolute;
      z-index: ${20 + index + 1};
      top: ${offsetY + 15}px;
      left: ${offsetX + leftOffset}px;
      width: 30px;
      height: 40px;
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateY(-50%) rotate(8deg);
      border: 1px solid white;
      border-radius: 4px;
      overflow: hidden;
      background: #112036;
    `,
  };
};

// ============================================
// 대륙 클러스터 스타일
// ============================================

export const createContinentClusterStyles = (index: number = 0, angleOffset: number = 0, distance: number = 100) => {
  const { lineLength, offsetX } = calculateLabelOffset(angleOffset, distance);

  return {
    dot: DOT_STYLE,
    horizontalLine: createHorizontalLineStyle(lineLength, offsetX),
    // 외부 wrapper - 그라디언트 border 역할
    labelWrapper: `
      position: absolute;
      z-index: ${20 + index};
      top: -3px;
      left: ${angleOffset === 0 ? "10px" : "-10px"};
      transform: translateY(-50%);
      padding: 1.5px;
      border-radius: 50px;
      background: radial-gradient(95.88% 89.71% at 17.16% 14.06%, #00D9FF 0%, #60E7FF 56.15%, #C6F6FF 100%);
      pointer-events: auto;
      cursor: pointer;
    `,
    // 내부 label - 실제 콘텐츠
    label: `
      display: inline-flex;
      padding: 12px 16px;
      align-items: center;
      gap: 5px;
      border-radius: 48.5px;
      background: rgba(31, 74, 105);
      box-shadow: 0 2px 20px 0 rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      color: #FFF;
      font-size: 16px;
      font-style: normal;
      font-weight: 500;
      line-height: 1.5;
      letter-spacing: -0.32px;
      font-feature-settings: 'liga' off, 'clig' off;
      user-select: none;
      white-space: nowrap;
    `,
  };
};

// ============================================
// 국가 클러스터 스타일
// ============================================

export const createCountryClusterStyles = (
  index: number = 0,
  angleOffset: number = 0,
  distance: number = 100,
  rightPadding: number = 30
) => {
  const { lineLength, offsetX, offsetY } = calculateLabelOffset(angleOffset, distance);

  return {
    dot: DOT_STYLE,
    horizontalLine: createHorizontalLineStyle(lineLength, offsetX),
    label: `
      display: inline-flex;
      padding: 6px ${rightPadding}px 6px 12px;
      align-items: center;
      gap: 5px;
      border-radius: 50px;
      border: 1px solid #b3daff;
      background: rgba(31, 74, 105, 0.1);
      box-shadow: 0 2px 20px 0 rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      color: #FFF;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 1.5;
      font-feature-settings: 'liga' off, 'clig' off;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      pointer-events: auto;
      position: absolute;
      z-index: ${20 + index};
      top: ${offsetY + 15}px;
      left: ${offsetX}px;
      transform: translate(-50%, -50%);
      white-space: nowrap;
    `,
    countBadge: `
      display: flex;
      width: auto;
      min-width: 22px;
      height: 20px;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0;
      padding: 2px 5px;
      border-radius: 1000px;
      background: rgba(89, 190, 229, 0.5);
      color: #FFF;
      text-align: center;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: 1.28;
      font-feature-settings: 'liga' off, 'clig' off;
    `,
    actionButton: (leftOffset: number) => `
      position: absolute;
      z-index: ${20 + index + 1};
      top: ${offsetY + 15}px;
      left: ${offsetX + leftOffset}px;
      width: 37px;
      height: 44px;
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: -20px;
      transform: translateY(-50%);
    `,
    thumbnailCard: (leftOffset: number) => `
      position: absolute;
      z-index: ${20 + index + 1};
      top: ${offsetY + 15}px;
      left: ${offsetX + leftOffset}px;
      width: 30px;
      height: 40px;
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateY(-50%) rotate(8deg);
      border: 1px solid #b3daff;
      border-radius: 4px;
      overflow: hidden;
      background: #112036;
    `,
  };
};
