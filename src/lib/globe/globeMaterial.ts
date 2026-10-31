import { ShaderMaterial } from "three";

// Figma 디자인의 지구본 그라디언트를 화면 기준으로 그리는 재질
// 텍스처로 감싸면 그라디언트가 지표면에 고정되어, 지구본을 돌리면 특정 위치(남반구)만 까맣게 보인다.
// 대신 카메라 기준 법선으로 원판 위 좌표를 구해 색을 계산하므로 어느 방향에서 봐도 같은 색으로 보인다.
// 색은 Figma(캔버스)처럼 sRGB 값 그대로 섞고 그대로 출력한다.
export const createGlobeMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vViewNormal;

      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vViewNormal;

      void main() {
        // 화면에 보이는 원판을 Figma 프레임 좌표(좌상단 0,0 ~ 우하단 1,1)로 변환
        vec2 uv = vec2(0.5 + 0.5 * vViewNormal.x, 0.5 - 0.5 * vViewNormal.y);

        // 첫 번째 그라디언트: 메인 배경 (검정색에서 #032F59)
        // Figma 기반: 중심 (50%, 81.13%), 반지름 70.45%
        float t1 = clamp(distance(uv, vec2(0.5, 0.8113)) / 0.7045, 0.0, 1.0);
        vec3 color = mix(vec3(0.0), vec3(3.0, 47.0, 89.0) / 255.0, t1);

        // 두 번째 그라디언트: 테두리의 흰색 오버레이
        // Figma 기반: 중심 (50%, 50%), 반지름 50%, 83.61% 지점부터 100% 지점까지 10% 불투명으로 밝아짐
        // Figma에는 중심(0%~15.77%)에도 흰색이 있지만, 화면 기준으로 그리면 항상 가운데에 흰 점으로 보이므로 뺀다
        float t2 = clamp(distance(uv, vec2(0.5)) / 0.5, 0.0, 1.0);
        float overlay = mix(0.0, 0.1, clamp((t2 - 0.8361) / (1.0 - 0.8361), 0.0, 1.0));
        color = mix(color, vec3(1.0), overlay);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
