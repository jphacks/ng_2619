// Run before npm ci so older npm versions never try to parse the v3 lockfile.
const nodeMajor = Number(process.versions.node.split(".")[0]);
const npmVersion = (process.env.npm_config_user_agent ?? "").match(/npm\/(\d+(?:\.\d+)*)/);
if (nodeMajor < 22 || (npmVersion && Number(npmVersion[1].split(".")[0]) < 9)) {
  console.error(`現在の環境: Node.js ${process.version} / npm ${npmVersion?.[1] ?? "不明"}`);
  console.error("このアプリには Node.js 22以上と npm 9以上が必要です。");
  console.error("nvm-windows を利用している場合は、PowerShellで次を実行してください:");
  console.error("  nvm install 22\n  nvm use 22");
  console.error("PowerShellを開き直し、node -v と npm -v を確認してから npm run setup を再実行してください。");
  process.exit(1);
}
