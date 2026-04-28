@AGENTS.md

## Superpowers Methodology

### Verification Before Completion
- NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
- 빌드(`next build`), 린트(`eslint`), 타입체크 모두 통과해야 "완료"
- "should work" 금지 — 실행 결과 증거 필수

### Systematic Debugging
- NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
- 에러 메시지를 끝까지 읽고, 재현하고, 원인 파악 후 수정

### Test-Driven Development
- 기능 추가 시 테스트 먼저 → 실패 확인 → 구현 → 통과 확인
