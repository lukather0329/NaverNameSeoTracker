import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { runTrackingJob } from "../services/rank-tracking-service.js";

export function startTrackingScheduler() {
  cron.schedule("*/30 * * * *", async () => {
    const now = new Date();
    const jobs = await prisma.rankTrackingJob.findMany({
      where: {
        isEnabled: true,
        interval: "30_MINUTES",
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }]
      }
    });

    await Promise.allSettled(jobs.map((job) => runTrackingJob(job.id)));
  });

  cron.schedule("0 * * * *", async () => {
    const now = new Date();
    const jobs = await prisma.rankTrackingJob.findMany({
      where: {
        isEnabled: true,
        interval: "60_MINUTES",
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }]
      }
    });

    await Promise.allSettled(jobs.map((job) => runTrackingJob(job.id)));
  });
}
