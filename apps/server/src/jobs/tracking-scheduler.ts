import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { runTrackingJob } from "../services/rank-tracking-service.js";

export function startTrackingScheduler() {
  cron.schedule("*/30 * * * *", async () => {
    const jobs = await prisma.rankTrackingJob.findMany({
      where: { isEnabled: true, interval: "30_MINUTES" }
    });

    await Promise.allSettled(jobs.map((job) => runTrackingJob(job.id)));
  });

  cron.schedule("0 * * * *", async () => {
    const jobs = await prisma.rankTrackingJob.findMany({
      where: { isEnabled: true, interval: "60_MINUTES" }
    });

    await Promise.allSettled(jobs.map((job) => runTrackingJob(job.id)));
  });
}
