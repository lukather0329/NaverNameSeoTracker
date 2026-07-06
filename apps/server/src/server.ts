import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { startTrackingScheduler } from "./jobs/tracking-scheduler.js";

const app = createApp();

app.listen(config.port, () => {
  startTrackingScheduler();
  console.log(`API server listening on http://localhost:${config.port}`);
});
