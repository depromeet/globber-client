// Figma 디자인에서 지구본용 그라디언트 텍스처 생성
export const createGlobeImageUrl = (): string => {
  if (typeof window === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  // 첫 번째 그라디언트: 메인 배경 (검정색에서 #032F59)
  // Figma 기반: gradientHandlePositions [0.5, 0.8113], [0.5, 0.1069], [1.2045, 0.8113]
  const gradient1 = ctx.createRadialGradient(
    256,
    415, // 중심 위치: 50%, 81.13%
    0, // 내부 반지름
    256,
    415, // 외부 중심
    361 // 외부 반지름 (512의 70.45%)
  );
  gradient1.addColorStop(0, "#000000");
  gradient1.addColorStop(1, "#032f59");

  ctx.fillStyle = gradient1;
  ctx.fillRect(0, 0, 512, 512);

  // 두 번째 그라디언트: 투명도가 있는 흰색 오버레이
  // Figma 기반: gradientHandlePositions [0.5, 0.5], [0.5, 1], [0, 0.5]
  ctx.globalCompositeOperation = "source-over";
  const gradient2 = ctx.createRadialGradient(
    256,
    256, // 중심 위치: 50%, 50%
    0, // 내부 반지름
    256,
    256, // 외부 중심
    256 // 외부 반지름 (512의 50%)
  );
  gradient2.addColorStop(0, "rgba(255, 255, 255, 0.1)"); // 10% 투명도
  gradient2.addColorStop(0.1577, "rgba(255, 255, 255, 0)");
  gradient2.addColorStop(0.8361, "rgba(255, 255, 255, 0)");
  gradient2.addColorStop(1, "rgba(255, 255, 255, 0.1)");

  ctx.fillStyle = gradient2;
  ctx.fillRect(0, 0, 512, 512);

  return canvas.toDataURL();
};
