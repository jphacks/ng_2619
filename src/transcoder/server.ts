// 動画変換サービス（基本設計書 5.1 F-SYS-01）。Cloud Run に別コンテナとしてデプロイする。
// Eventarc（google.cloud.storage.object.v1.finalized）から HTTP POST で呼ばれる。
// 失敗したら 500 を返し、Eventarc に再試行させる。3回目の失敗で動画を FAILED にする。

import { createServer } from "node:http";
import { logger } from "../server/logger";
import { processRawObject } from "../server/services/videos";

const port = Number(process.env.PORT ?? 8080);

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200).end("ok");
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    try {
      // CloudEvent（構造化モード）の data にオブジェクト情報が入る。バイナリモードでは body がそのまま data
      const body = raw ? JSON.parse(raw) : {};
      const objectName: string | undefined = body?.data?.name ?? body?.name;
      if (!objectName) {
        res.writeHead(400).end("no object name");
        return;
      }
      const result = await processRawObject(objectName);
      logger.info("transcode handled", { objectName, result });
      res.writeHead(200).end(result);
    } catch (e) {
      logger.error("transcode request failed", { error: e });
      res.writeHead(500).end("error");
    }
  });
}).listen(port, () => logger.info(`transcoder listening on ${port}`));
