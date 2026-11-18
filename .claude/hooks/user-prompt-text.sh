#!/bin/sh
# UserPromptSubmit 안내 훅 공용 도우미: 입력 JSON의 prompt에서 사용자가 직접 쓴 문장만 출력
# 자동 에이전트 보고는 사용자 입력에서 제외함
# 붙여넣은 내용(<pasted_content>)은 사용자 문장이 아니라 인용 자료라서 함께 제외함
# Oniguruma의 $는 줄 끝이라 닫는 태그가 없을 때의 문자열 끝은 \z로 지정함

jq -r '(.prompt // "")
  | if test("^\\s*<send_user_message_question_reply>") then
      (try (capture("<send_user_message_question_reply>\\s*(?<body>[\\s\\S]*?)\\s*</send_user_message_question_reply>").body
        | fromjson | map(.answer // empty) | join("\n")) catch "")
    else . end
  | gsub("<agent-message\\b[\\s\\S]*?(</agent-message>|\\z)"; "")
  | gsub("<pasted_content\\b[\\s\\S]*?(</pasted_content[^>]*>|\\z)"; "")
  | gsub("Another Claude session sent a message[^\\n]*"; "")' 2>/dev/null
