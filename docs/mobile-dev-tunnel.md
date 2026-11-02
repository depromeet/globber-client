# 모바일 기기에서 로컬 개발 서버 확인하기

PC에서 켠 로컬 개발 서버를 휴대폰에서도 보면서 모바일 UI를 개발하는 방법입니다.
카카오 로그인까지 폰에서 그대로 동작합니다.

## 빠른 시작

```bash
pnpm dev:tunnel
```

실행하면 아래처럼 터널 주소가 출력되고, 이어서 개발 서버가 뜹니다.

```
[dev-tunnel] 모바일에서 아래 주소로 접속하세요
  https://xxxx-xxxx-xxxx-xxxx.trycloudflare.com
```

폰 브라우저에서 이 주소로 접속하면 됩니다. PC에서 코드를 저장하면 폰 화면에도 반영됩니다.
자동으로 안 바뀌면 새로고침하세요.

종료는 터미널에서 `Ctrl + C`입니다. 개발 서버와 터널이 같이 꺼집니다.

## 사전 준비 (최초 1회)

터널 프로그램 `cloudflared`가 필요합니다. 계정 가입은 필요 없습니다.

```bash
brew install cloudflared
```

확인:

```bash
cloudflared --version
```

### brew 설치가 실패할 때

일부 환경에서 brew가 번들을 푸는 단계에서 `terminated by uncaught signal KILL`로 실패한 적이 있습니다.
이 경우 바이너리를 직접 받아서 PATH에 넣으면 됩니다.

```bash
# Apple Silicon (M 시리즈). Intel Mac은 darwin-amd64.tgz
curl -fsSL -o cloudflared.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz
tar xzf cloudflared.tgz
sudo mv cloudflared /usr/local/bin/
cloudflared --version
```

## 동작 방식

1. `cloudflared`가 Cloudflare로 먼저 연결을 걸어 두고, `https://<랜덤>.trycloudflare.com` 주소를 받습니다.
2. 폰이 이 주소로 접속하면 Cloudflare가 연결을 통해 PC의 `localhost:3000`으로 요청을 전달합니다.
3. 스크립트는 받은 주소를 `NEXT_PUBLIC_REDIRECT_ORIGIN` 환경변수로 넘겨 `next dev`를 실행합니다.

3번이 필요한 이유: 터널로 들어온 요청은 서버 입장에서 호스트가 `localhost:3000`으로 보입니다.
`src/app/login/oauth/success/route.ts`가 로그인 후 이동할 주소를 이 값으로 만들기 때문에, 환경변수가 없으면 로그인 후 폰이 `localhost:3000`으로 이동해서 페이지가 열리지 않습니다.
`pnpm dev`로 서버를 띄운 뒤 터널만 따로 열면 이 문제가 생깁니다. `pnpm dev:tunnel`을 쓰면 자동으로 처리됩니다.

백엔드 설정 변경은 필요 없습니다.

## 주의사항

- **주소는 실행할 때마다 바뀝니다.** 임시 터널이라 고정되지 않습니다. 다시 실행하면 폰에서 새 주소로 접속하세요.
- **주소가 바뀌면 폰에서 다시 로그인해야 합니다.** 로그인 쿠키는 주소(도메인)별로 따로 저장됩니다.
- **주소를 아는 사람은 누구나 접속할 수 있습니다.** 개발 중인 화면이 외부에 열리므로 주소를 공유하지 말고, 작업이 끝나면 `Ctrl + C`로 종료하세요.
- PC가 켜져 있고 `pnpm dev:tunnel`이 실행 중인 동안만 접속됩니다. 같은 와이파이일 필요는 없습니다.
- 포트를 바꾸려면 `PORT=3001 pnpm dev:tunnel`로 실행하세요.
- 스크립트는 macOS에서 확인했습니다.

## 문제 해결

| 증상                                                     | 원인과 해결                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cloudflared를 찾을 수 없습니다`                         | cloudflared 미설치. 위 사전 준비를 진행하세요.                                                         |
| 폰에서 `530` 에러가 뜸                                   | 터널이 꺼진 상태입니다. `pnpm dev:tunnel`이 실행 중인지, 출력된 최신 주소로 접속했는지 확인하세요.     |
| 로그인 후 `localhost:3000`으로 이동해서 페이지가 안 열림 | `pnpm dev`로 띄웠거나 터널을 따로 연 경우입니다. 종료하고 `pnpm dev:tunnel` 한 번으로 다시 실행하세요. |
| 주소를 못 받고 30초 후 종료됨                            | 네트워크 문제일 수 있습니다. 잠시 뒤 다시 실행하세요. 사내 VPN이나 방화벽이 있으면 꺼 보세요.          |
| 폰 화면이 자동으로 안 바뀜                               | 새로고침하세요. 그래도 안 바뀌면 PC에서 `localhost:3000`에는 반영되는지 먼저 확인하세요.               |
