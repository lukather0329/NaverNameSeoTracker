import cron from "node-cron";
import { parseTrackingIntervalMinutes } from "@naver-seo-tracker/shared";
import { prisma } from "../lib/prisma.js";
import { runTrackingJob } from "../services/rank-tracking-service.js";

// Promise.allSettled는 실패한 작업을 조용히 삼켜 버린다. 지금까지는 실패해도 아무
// 로그가 남지 않아서, 어떤 키워드가 왜 멈췄는지 전혀 알 수 없었다(실제로 6개 중 3개
// job이 하루 넘게 멈췄는데도 SystemLog에는 아무 기록이 없었던 원인이 이것).
// 실패한 job은 반드시 SystemLog에 남기고, retryCount도 올려서 화면에서 바로 보이게 한다.
async function runJobsAndLogFailures(jobs: Array<{ id: string; keyword: string }>) {
  const settled = await Promise.allSettled(jobs.map((job) => runTrackingJob(job.id)));

  await Promise.all(
    settled.map(async (result, index) => {
      if (result.status === "rejected") {
        const job = jobs[index];
        if (!job) {
          return;
        }
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);

        await prisma.systemLog.create({
          data: {
            level: "ERROR",
            scope: "rank-tracking-run",
            message: `"${job.keyword}" 키워드 자동 추적이 실패했습니다.`,
            metaJson: JSON.stringify({ jobId: job.id, keyword: job.keyword, error: message })
          }
        });

        await prisma.rankTrackingJob.update({
          where: { id: job.id },
          data: { retryCount: { increment: 1 } }
        }).catch(() => undefined);
      }
    })
  );
}

// 예전에는 30분/60분 두 가지 cron 스케줄만 있어서, 3시간/6시간/12시간/수동(N분) 같은
// 임의의 주기를 지원할 수 없었다. 대신 5분마다 한 번씩 전체 활성 job을 확인해서,
// 각 job의 개별 주기(lastRunAt + interval)가 지난 job만 골라 실행하는 방식으로 바꿨다.
// 주기가 5분 단위로 반올림되는 오차는 있지만, 수동 설정을 포함한 모든 주기를 하나의 로직으로 처리할 수 있다.
export function startTrackingScheduler() {
  cron.schedule("*/5 * * * *", async () => {
    const jobs = await prisma.rankTrackingJob.findMany({
      where: { isEnabled: true }
    });

    const now = Date.now();
    const dueJobs = jobs.filter((job) => {
      const intervalMs = parseTrackingIntervalMinutes(job.interval) * 60 * 1000;
      const lastRunMs = job.lastRunAt ? job.lastRunAt.getTime() : 0;
      return now - lastRunMs >= intervalMs;
    });

    if (dueJobs.length > 0) {
      await runJobsAndLogFailures(dueJobs);
    }
  });
}
