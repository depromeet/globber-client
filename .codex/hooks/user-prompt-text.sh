#!/bin/sh
# UserPromptSubmit 안내 훅 공용 도우미: 입력 JSON의 prompt에서 사용자가 직접 쓴 문장만 출력
# 백그라운드 subagent 보고(<agent-message>)도 UserPromptSubmit으로 들어와 안내 훅이 보고 본문에 반응하던 오탐을 막으려고 제외함
# 붙여넣은 내용(<pasted_content>)은 사용자 문장이 아니라 인용 자료라서 함께 제외함
# Oniguruma의 $는 줄 끝이라 닫는 태그가 없을 때의 문자열 끝은 \z로 지정함

jq -r '(.prompt // "")
  | gsub("<agent-message\\b[\\s\\S]*?(</agent-message>|\\z)"; "")
  | gsub("<pasted_content\\b[\\s\\S]*?(</pasted_content[^>]*>|\\z)"; "")
  | gsub("Another Claude session sent a message[^\\n]*"; "")' 2>/dev/null
