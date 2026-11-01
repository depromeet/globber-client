/**
 * 모바일 기기에서 로컬 개발 서버를 확인하기 위한 터널 + 개발 서버 실행 스크립트
 *
 * 1. cloudflared 임시 터널(trycloudflare.com)을 연다
 * 2. 발급된 주소를 NEXT_PUBLIC_REDIRECT_ORIGIN으로 넘겨 next dev를 실행한다
 *    (카카오 로그인 후 localhost가 아닌 터널 주소로 돌아오게 하기 위함)
 *
 * 사용법: pnpm dev:tunnel  (포트 변경: PORT=3001 pnpm dev:tunnel)
 */
const { spawn, spawnSync } = require("child_process");

const PORT = process.env.PORT || "3000";
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const TUNNEL_TIMEOUT_MS = 30000;
// 주소가 여러 청크에 걸쳐 오더라도 찾을 수 있도록 stderr를 누적하되, 크기는 제한한다
const MAX_OUTPUT_LENGTH = 8192;

const children = [];

function shutdown(code) {
  children.forEach(child => child.kill());
  process.exit(code);
}

function fail(message) {
  console.error(`[dev-tunnel] ${message}`);
  shutdown(1);
}

function checkCloudflared() {
  const result = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });

  if (result.error?.code === "ENOENT") {
    console.error("[dev-tunnel] cloudflared를 찾을 수 없습니다.");
    console.error("  설치: brew install cloudflared");
    console.error("  자세한 내용: docs/mobile-dev-tunnel.md");
    process.exit(1);
  }

  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.code || result.error.message : `exit ${result.status}`;
    console.error(`[dev-tunnel] cloudflared 실행에 실패했습니다 (${reason})`);
    process.exit(1);
  }
}

function openTunnel() {
  return new Promise((resolve, reject) => {
    const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`]);
    children.push(tunnel);

    let hasUrl = false;
    let output = "";

    const timer = setTimeout(() => reject(new Error("터널 주소를 받지 못했습니다 (30초 초과)")), TUNNEL_TIMEOUT_MS);

    // 주소를 받기 전에는 reject로 main에 넘기고, 받은 뒤에는 터널이 죽은 것이므로 개발 서버까지 종료한다
    const handleTunnelStop = message => {
      clearTimeout(timer);
      if (hasUrl) {
        fail(message);
      } else {
        reject(new Error(message));
      }
    };

    // cloudflared는 주소를 stderr로 출력한다
    tunnel.stderr.on("data", chunk => {
      if (hasUrl) return;

      output = (output + chunk.toString()).slice(-MAX_OUTPUT_LENGTH);
      const match = output.match(TUNNEL_URL_PATTERN);
      if (match) {
        hasUrl = true;
        clearTimeout(timer);
        resolve(match[0]);
      }
    });

    tunnel.on("error", error => handleTunnelStop(`cloudflared 실행에 실패했습니다 (${error.message})`));
    tunnel.on("exit", code => handleTunnelStop(`cloudflared가 종료되었습니다 (code ${code})`));
  });
}

async function main() {
  checkCloudflared();

  const tunnelUrl = await openTunnel();
  console.log("\n[dev-tunnel] 모바일에서 아래 주소로 접속하세요");
  console.log(`  ${tunnelUrl}\n`);

  // pnpm을 거치면 종료 신호가 next-server까지 전달되지 않을 수 있어 next를 직접 실행한다
  const nextBin = require.resolve("next/dist/bin/next");
  const dev = spawn(process.execPath, [nextBin, "dev", "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_REDIRECT_ORIGIN: tunnelUrl },
  });
  children.push(dev);

  dev.on("error", error => fail(`next dev 실행에 실패했습니다 (${error.message})`));
  dev.on("exit", code => shutdown(code ?? 0));
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch(error => fail(error.message));
