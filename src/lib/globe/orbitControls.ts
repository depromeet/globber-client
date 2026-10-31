import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// globe.gl 기본 감쇠 계수 (60fps 한 프레임 기준)
const DAMPING_PER_60FPS_FRAME = 0.1;

type SmoothedOrbitControls = OrbitControls & { __smoothed?: boolean };

/**
 * 지구본 회전이 화면 주사율과 관계없이 고르게 움직이도록 OrbitControls를 보정합니다.
 * @note OrbitControls는 포인터 이벤트 안에서도 update()를 직접 호출해 감쇠를 한 번 더 적용한다.
 *       120Hz 화면에 60Hz 마우스 입력이 들어오면 입력이 있는 프레임만 두 배로 움직여 회전이 번갈아 튄다.
 *       감쇠 계수도 프레임 단위라 주사율이 다르면 손에 붙는 느낌이 달라진다.
 *       그래서 회전·이동 감쇠는 렌더 루프(deltaTime 전달)에서만 적용하고, 감쇠는 경과 시간 기준으로 환산한다.
 *       줌과 거리 제한, change 이벤트는 원래처럼 입력 이벤트에서 바로 반영한다.
 */
export const smoothOrbitControls = (controls: OrbitControls) => {
  const smoothed = controls as SmoothedOrbitControls;
  if (smoothed.__smoothed) return;
  smoothed.__smoothed = true;

  const originalUpdate = controls.update.bind(controls);
  controls.update = (deltaTime?: number | null) => {
    // 입력 이벤트에서 호출된 update는 감쇠 계수 0으로 실행해 회전·이동은 다음 렌더 프레임으로 미루고,
    // 줌은 원래처럼 이벤트마다 거리 제한을 적용한다
    if (deltaTime == null) {
      if (!controls.enableDamping) return originalUpdate();

      const dampingFactor = controls.dampingFactor;
      controls.dampingFactor = 0;
      try {
        return originalUpdate();
      } finally {
        controls.dampingFactor = dampingFactor;
      }
    }

    controls.dampingFactor = 1 - Math.pow(1 - DAMPING_PER_60FPS_FRAME, deltaTime * 60);
    return originalUpdate(deltaTime);
  };
};
