// GA4 일일 지표를 조회해서 Discord 웹훅으로 보낸다.
// 매일 오전 9시(KST)에 GitHub Actions(.github/workflows/daily-metrics.yml)가 실행한다.
//
// 환경 변수
// - GA_ACCESS_TOKEN: analytics.readonly 범위의 액세스 토큰 (mock 모드에서는 필요 없음)
// - DISCORD_WEBHOOK_URL: 보낼 Discord 웹훅 주소 (없으면 메시지를 보내지 않고 출력만 함)
// - REPORT_DATE: 집계할 날짜(YYYY-MM-DD, KST). 없으면 어제
// - MOCK: "true"면 GA 대신 예시 데이터로 메시지를 만든다
//
// 로컬 실행 예시: node scripts/daily-metrics.mjs --mock

const PROPERTY_ID = "529924638";
const ACCOUNT_ID = "388768645";
const HOST_NAME = "globber.world";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SPARK_CHARS = "▁▂▃▄▅▆▇█";

const COLORS = {
  up: 0x22c55e,
  down: 0xf97316,
  flat: 0x9ca3af,
};

const args = process.argv.slice(2);
const isMock = args.includes("--mock") || process.env.MOCK === "true";

// YYYY-MM-DD 문자열을 다루는 날짜 유틸 (모두 KST 달력 기준)
const toDateString = date => date.toISOString().slice(0, 10);
const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
};
const getYesterdayKst = () => addDays(toDateString(new Date(Date.now() + KST_OFFSET_MS)), -1);
const weekday = dateString => WEEKDAYS[new Date(`${dateString}T00:00:00Z`).getUTCDay()];
const formatShort = dateString => {
  const [, month, day] = dateString.split("-").map(Number);
  return `${month}/${day}(${weekday(dateString)})`;
};

const hostFilter = {
  filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: HOST_NAME } },
};

const runReport = async (accessToken, body) => {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ dimensionFilter: hostFilter, ...body }),
  });
  if (!response.ok) {
    throw new Error(`GA runReport 실패 (${response.status}): ${await response.text()}`);
  }
  return response.json();
};

const sumActiveUsers = async (accessToken, startDate, endDate) => {
  const report = await runReport(accessToken, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "activeUsers" }],
  });
  return Number(report.rows?.[0]?.metricValues[0].value ?? 0);
};

// 집계일 포함 최근 8일의 일별 지표, 7일·28일 활성 사용자를 조회한다
const fetchMetrics = async (accessToken, reportDate) => {
  const dates = Array.from({ length: 8 }, (_, i) => addDays(reportDate, i - 7));
  const daily = await runReport(accessToken, {
    dateRanges: [{ startDate: dates[0], endDate: reportDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }],
  });

  const byDate = new Map(
    (daily.rows ?? []).map(row => {
      const raw = row.dimensionValues[0].value;
      const key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const [activeUsers, newUsers, sessions] = row.metricValues.map(v => Number(v.value));
      return [key, { activeUsers, newUsers, sessions }];
    })
  );
  const empty = { activeUsers: 0, newUsers: 0, sessions: 0 };
  const today = byDate.get(reportDate) ?? empty;
  const previous = byDate.get(dates[6]) ?? empty;

  const [wau, mau] = await Promise.all([
    sumActiveUsers(accessToken, addDays(reportDate, -6), reportDate),
    sumActiveUsers(accessToken, addDays(reportDate, -27), reportDate),
  ]);

  return {
    dau: today.activeUsers,
    previousDau: previous.activeUsers,
    wau,
    mau,
    newUsers: today.newUsers,
    sessions: today.sessions,
    last7Days: dates.slice(1).map(date => ({ date, dau: (byDate.get(date) ?? empty).activeUsers })),
  };
};

const buildMockMetrics = reportDate => {
  const values = [9, 10, 14, 11, 8, 16, 12];
  return {
    dau: 12,
    previousDau: 16,
    wau: 41,
    mau: 118,
    newUsers: 5,
    sessions: 17,
    last7Days: values.map((dau, i) => ({ date: addDays(reportDate, i - 6), dau })),
  };
};

// 최솟값~최댓값 구간을 8단계 막대로 나눠서 7일 추이를 한 줄로 표시한다
const sparkline = values => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return SPARK_CHARS[max === 0 ? 0 : 3].repeat(values.length);
  return values.map(v => SPARK_CHARS[Math.round(((v - min) / (max - min)) * (SPARK_CHARS.length - 1))]).join("");
};

const buildReportUrl = reportDate => {
  const filter = JSON.stringify([
    {
      type: 1,
      fieldName: "hostname",
      evaluationType: 3,
      expressionList: [HOST_NAME],
      complement: false,
      isCaseSensitive: true,
      expression: "",
    },
  ]);
  const params = `_u.date00=${addDays(reportDate, -27).replaceAll("-", "")}&_u.date01=${reportDate.replaceAll("-", "")}&_r..dataFilters=${filter}`;
  return `https://analytics.google.com/analytics/web/#/a${ACCOUNT_ID}p${PROPERTY_ID}/reports/explorer?params=${encodeURIComponent(params)}&r=user-technology-detail`;
};

const buildPayload = (metrics, reportDate, runDate) => {
  const diff = metrics.dau - metrics.previousDau;
  const trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const diffText = diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : "─";
  const stickiness = metrics.mau > 0 ? `${((metrics.dau / metrics.mau) * 100).toFixed(1)}%` : "-";
  const sessionsPerUser = metrics.dau > 0 ? (metrics.sessions / metrics.dau).toFixed(1) : "0";
  const values = metrics.last7Days.map(d => d.dau);
  const first = metrics.last7Days[0].date;
  const last = metrics.last7Days.at(-1).date;

  return {
    username: "Globber 지표",
    embeds: [
      {
        title: `📊 Globber 일일 지표 · ${formatShort(runDate)}${isMock ? " [테스트]" : ""}`,
        url: buildReportUrl(reportDate),
        description: `${reportDate}(${weekday(reportDate)}) 하루 · ${HOST_NAME} 기준`,
        color: COLORS[trend],
        fields: [
          { name: "👤 DAU", value: `**${metrics.dau}**  ${diffText}`, inline: true },
          { name: "👥 WAU", value: `**${metrics.wau}**`, inline: true },
          { name: "🗓️ MAU (28일)", value: `**${metrics.mau}**`, inline: true },
          { name: "📈 DAU/MAU", value: `**${stickiness}**\n월 사용자 중 매일 방문 비율`, inline: true },
          { name: "🆕 신규 사용자", value: `**${metrics.newUsers}**`, inline: true },
          { name: "🔁 세션", value: `**${metrics.sessions}**\n방문 횟수 (1인당 ${sessionsPerUser}회)`, inline: true },
          {
            name: "최근 7일 DAU",
            value: `\`${sparkline(values)}\`  ${values.join(" · ")}\n${formatShort(first)} ~ ${formatShort(last)}`,
            inline: false,
          },
          { name: "​", value: `[GA 보고서 열기 ↗](${buildReportUrl(reportDate)})`, inline: false },
        ],
        footer: {
          text: isMock
            ? "테스트 메시지 · 예시 데이터이며 실제 지표가 아님"
            : "GA4 · 최근 1~2일 수치는 처리 지연으로 조금 달라질 수 있음",
        },
      },
    ],
  };
};

const main = async () => {
  const reportDate = process.env.REPORT_DATE || getYesterdayKst();
  const runDate = addDays(reportDate, 1);

  let metrics;
  if (isMock) {
    metrics = buildMockMetrics(reportDate);
  } else {
    const accessToken = process.env.GA_ACCESS_TOKEN;
    if (!accessToken) throw new Error("GA_ACCESS_TOKEN이 설정되지 않았습니다.");
    metrics = await fetchMetrics(accessToken, reportDate);
  }

  const payload = buildPayload(metrics, reportDate, runDate);
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("DISCORD_WEBHOOK_URL이 없어 전송하지 않고 내용만 출력합니다.");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Discord 전송 실패 (${response.status}): ${await response.text()}`);
  }
  console.log(`${reportDate} 지표를 Discord로 보냈습니다.`, JSON.stringify(metrics));
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
