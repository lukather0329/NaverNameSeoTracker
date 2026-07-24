import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { startTrackingScheduler } from "./jobs/tracking-scheduler.js";

const app = createApp();

if (!config.encryptionSecret) {
  console.warn(
    "[경고] ENCRYPTION_SECRET이 설정되지 않았습니다. API 계정 시크릿이 암호화되지 않고 저장됩니다. .env에 ENCRYPTION_SECRET을 추가하세요."
  );
}

app.listen(config.port, () => {
  startTrackingScheduler();
  console.log(`API server listening on http://localhost:${config.port}`);
});
