import { prisma } from "../lib/prisma.js";

type LogLevel = "INFO" | "WARN" | "ERROR";

export async function writeSystemLog(input: {
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.systemLog.create({
    data: {
      level: input.level,
      scope: input.scope,
      message: input.message,
      metaJson: input.meta ? JSON.stringify(input.meta) : null
    }
  });
}

