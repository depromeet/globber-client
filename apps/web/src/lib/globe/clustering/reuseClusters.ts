import type { ClusterData } from "@/types/clustering";

// 내용 비교에 쓰는 도메인 필드 목록
// three-globe가 데이터 객체에 붙이는 __threeObjHtml 같은 렌더러 필드와 screenPos 같은 화면 계산 필드는 비교에서 제외함
const CONTENT_KEYS = [
  "id",
  "name",
  "flag",
  "lat",
  "lng",
  "color",
  "count",
  "clusterType",
  "isExpanded",
  "hasRecords",
  "thumbnailUrl",
  "recordCount",
] as const satisfies readonly (keyof ClusterData)[];

// thumbnails 같은 문자열 배열은 참조가 아니라 길이와 각 값으로 비교함
const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;

  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
};

const isSameItem = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord);

  return keys.length === Object.keys(bRecord).length && keys.every(key => isSameValue(aRecord[key], bRecord[key]));
};

const isSameCluster = (a: ClusterData, b: ClusterData): boolean =>
  CONTENT_KEYS.every(key => Object.is(a[key], b[key])) &&
  a.items.length === b.items.length &&
  a.items.every((item, index) => isSameItem(item, b.items[index]));

/**
 * 이전 클러스터 결과와 내용이 같으면 이전 객체와 배열을 그대로 재사용함
 * three-globe는 객체 참조로 같은 데이터인지 판단하므로, 참조가 바뀌면 라벨 DOM이 떼어졌다 다시 붙음
 * @param previous - 직전 계산 결과
 * @param next - 새로 계산한 결과
 * @returns 모두 같으면 previous, 일부만 같으면 같은 클러스터는 이전 객체를 쓴 새 배열
 */
export const reuseClusters = (previous: ClusterData[], next: ClusterData[]): ClusterData[] => {
  const previousById = new Map(previous.map(cluster => [cluster.id, cluster]));

  const merged = next.map(cluster => {
    const old = previousById.get(cluster.id);

    return old && isSameCluster(old, cluster) ? old : cluster;
  });

  const isSameArray =
    merged.length === previous.length && merged.every((cluster, index) => cluster === previous[index]);

  return isSameArray ? previous : merged;
};
