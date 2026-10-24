// .env を読み込む（DATABASE_URL など）
try {
  process.loadEnvFile(".env");
} catch {
  // .env がなければ環境変数をそのまま使う
}

// 結合テストは偽の動画データを使うため、ffmpeg が入っていても変換せずにコピーさせる。
// 変換そのものの確認は T-608（実際の動画で行う）
process.env.FFMPEG_PATH = "ffmpeg-disabled-in-tests";
