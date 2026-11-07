#!/bin/sh
# Stop 훅: 이번 턴에 출력한 assistant 텍스트 중 영어 위주인 블록이 있으면 턴 종료를 막고 한국어로 다시 쓰게 함
# 코드 블록·인라인 코드·URL·경로 토큰은 비율 계산에서 제외
# stop_hook_active가 true면(이미 한 번 막힌 뒤 재응답) 통과시켜 무한 반복 방지

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("stop_hook_active"):
    sys.exit(0)

# Stop 시점 transcript에 마지막 응답이 아직 없을 수 있어 last_assistant_message로 보완
last_message = data.get("last_assistant_message") or ""

lines = []
path = data.get("transcript_path")
if path:
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except Exception:
        lines = []

def is_user_prompt(entry):
    if entry.get("type") != "user":
        return False
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return any(isinstance(c, dict) and c.get("type") == "text" for c in content)
    return False

entries = []
for line in lines:
    try:
        entries.append(json.loads(line))
    except Exception:
        continue

start = 0
for i, entry in enumerate(entries):
    if is_user_prompt(entry):
        start = i + 1

texts = []
for entry in entries[start:]:
    if entry.get("type") != "assistant":
        continue
    for c in entry.get("message", {}).get("content", []):
        if isinstance(c, dict) and c.get("type") == "text" and c.get("text", "").strip():
            texts.append(c["text"])

if last_message.strip() and last_message not in texts:
    texts.append(last_message)

def strip_code(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\S*[/\\]\S*", " ", text)
    text = re.sub(r"\S+\.(tsx?|jsx?|md|json|sh|css|ya?ml)\b", " ", text)
    return text

def strip_ident(text):
    # 한국어 문장 속 영문 이름은 영어 문장이 아니므로 비율 계산에서 제외
    text = re.sub(r"[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)+", " ", text)  # kebab-case, snake_case, a.b
    text = re.sub(r"\b[A-Za-z]*[a-z][A-Z][A-Za-z]*\b", " ", text)  # camelCase, PascalCase(TaskCreate)
    text = re.sub(r"[A-Za-z]+(?=[가-힣])", " ", text)  # 한글 조사가 바로 붙은 이름(Skill을)
    return text

offenders = []
for text in texts:
    body = strip_ident(strip_code(text))
    hangul = len(re.findall(r"[가-힣]", body))
    latin = len(re.findall(r"[A-Za-z]", body))
    if latin < 20:
        continue
    if hangul / (hangul + latin) < 0.3:
        offenders.append(text.strip().splitlines()[0][:80])

if offenders:
    sample = " / ".join(offenders[:3])
    print(json.dumps({
        "decision": "block",
        "reason": "이번 턴에 영어 위주로 쓴 메시지가 있습니다(" + sample + "). 사용자에게 보이는 텍스트는 모두 한국어로 써야 합니다. 해당 내용을 한국어로 다시 정리해 답하세요.",
    }, ensure_ascii=False))
'

exit 0
