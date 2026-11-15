import { expect, it } from "vitest";

import { createIndividualCityClusters } from "./clusterCreators";

it("동일 도시 ID는 좌표 보정 후에도 같은 라벨 키를 사용한다", () => {
  const city = { id: "KOR", cityId: 123, name: "서울", lat: 37, lng: 127, flag: "🇰🇷", color: "blue" };
  expect(createIndividualCityClusters([city])[0].id).toBe("city_KOR_123");
  expect(createIndividualCityClusters([{ ...city, lat: 37.5 }])[0].id).toBe("city_KOR_123");
});
