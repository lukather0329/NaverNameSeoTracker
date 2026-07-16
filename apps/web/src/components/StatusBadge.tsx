interface StatusBadgeProps {
  value: string;
}

const statusLabelMap: Record<string, string> = {
  DRAFT: "초안",
  RUNNING: "진행 중",
  PAUSED: "일시중지",
  COMPLETED: "완료",
  FAILED: "실패",
  SUCCESS: "성공",
  EFFECTIVE: "효과 있음",
  LOW_EFFECT: "효과 낮음",
  PENDING: "판단 대기",
  WORSE: "악화",
  CONNECTED: "연결됨",
  DISCONNECTED: "미연결",
  LIVE_READY: "실테스트 가능",
  VALIDATION_READY: "검증 가능",
  INCOMPLETE: "미완료",
  REAL: "실연동",
  VALIDATION: "검증",
  INFO: "정보",
  WARN: "경고",
  ERROR: "오류",
  UP: "상승",
  DOWN: "하락",
  SAME: "유지",
  OUT: "이탈",
  UNVERIFIED: "미검증",
  EXPIRED: "만료"
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const label = statusLabelMap[value] ?? value;
  return <span className={`status-badge status-${value.toLowerCase()}`}>{label}</span>;
}