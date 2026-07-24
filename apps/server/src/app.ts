import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { router } from "./routes/index.js";

// 프로덕션에서는 웹(apps/web) 빌드 결과물을 이 서버가 함께 서빙할 수 있도록 한다.
// (별도 정적 호스팅/nginx 없이 Node 프로세스 하나로 배포하고 싶은 경우를 위한 옵션.)
// 빌드 산출물 폴더 깊이는 tsconfig 설정에 따라 달라질 수 있어서, cwd 기준으로
// 가능성 있는 경로 몇 개를 순서대로 확인한다. WEB_BUILD_DIR을 지정하면 그 값을 최우선으로 쓴다.
function resolveWebBuildDir(): string | null {
  const candidates = [
    process.env.WEB_BUILD_DIR,
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../../web/dist")
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use("/api", router);

  const webBuildDir = resolveWebBuildDir();

  if (webBuildDir) {
    app.use(express.static(webBuildDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(webBuildDir, "index.html"));
    });
  }

  return app;
}
