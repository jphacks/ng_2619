# 開発の進め方（3人チーム：フロントエンド1人・バックエンド2人）

実装タスクリスト（`../docs/jissoutasuku.md`）の担当を、次の3つに分けています。名前は決まったら書き換えてください。

| 担当 | 主な持ち場（ディレクトリ） | タスク |
|---|---|---|
| **FE**（フロントエンド） | `app/`（`app/api` 以外）、`components/`、`lib/api.ts`・`lib/hooks.ts`、`public/` | 画面すべて、デザイントークン、実機確認、アクセシビリティ、E2E |
| **BE-A**（認証・アカウント・基盤・運用） | `server/http.ts`、`server/auth/`、`server/services/{auth,account,children,inquiries,jobs}.ts`、`app/api/v1/{auth,me,children,inquiries}`、`middleware.ts`、`jobs/`、`Dockerfile`、CI/CD、インフラ | M0（基盤・インフラ）、M2、M3、M8、M9 |
| **BE-B**（ミッション・申請・動画・レベル） | `server/domain/`、`server/repositories/`、`server/storage/`、`server/services/{missions,reviews,kids,avatar,videos,masters,dashboard}.ts`、`app/api/v1/{missions,challenges,submissions,kids,masters,parent}`、`transcoder/`、`prisma/` | M1、M4〜M7 のAPI、動画変換 |

## ルール

1. **APIの契約は `lib/types.ts`（レスポンス）と `lib/schemas.ts`（入力チェック）**。バックエンドがここを変えるときは、PRにFEをレビュアーとして入れる。
2. **家族のデータは `server/repositories/scoped.ts` の関数で取る**（他の家族のIDなら404になる）。新しいAPIには「他の家族のIDでは404」のテストを必ず書く（NF-S-04）。
3. **チャレンジの状態は `server/domain/challenge.ts` の `transition()`、レベルは `server/domain/level.ts` の `addApproval()` でだけ変える**。
4. **DBの変更**は `npx prisma migrate dev --create-only` でSQLを作り、CHECK制約・部分一意インデックスは手で追記する（Prisma のスキーマでは書けないため）。
5. **子ども画面**は大きい文字・広いタップ領域（`tone="kid"`）、ひらがな中心で書く（NF-U-03〜05）。
6. PRを出す前に `npm run lint && npm run typecheck && npm test` を通す。main へのマージは、ほかの1人のレビューを受けてから。

## タスクの実装状況（2026-10-24 時点）

✅＝実装済み・テストあり　🟡＝一部実装（残りあり）　⬜＝未着手

| ID | タスク | 状況 | 担当 | 残っていること |
|---|---|---|---|---|
| T-001〜T-006 | プロジェクト・構成・ローカル環境・DB基盤・API共通基盤・ロガー | ✅ | BE-A | ローカルの動画保存は fake-gcs-server ではなく `.storage/`（下の「設計書との差分」1） |
| T-007 | CI | ✅ | BE-A | `../.github/workflows/ci.yml`。リポジトリのルートが `src/` の場合は移動する |
| T-008 | デザイントークン・共通レイアウト | 🟡 | FE | `app/globals.css` に仮のトークン。デザイナーと配色・余白を決める |
| T-009 / T-010 | GCP環境構築 / CD | ⬜ | BE-A | Dockerfile は用意済み。Cloud Run・Cloud SQL・バケット3つ・Secret Manager・LB/CDN、デプロイの流れ【保留 BQ-01, 03, 17】 |
| T-101〜T-106 | テーブル・シード・シード検証・リポジトリ層 | ✅ | BE-B | |
| T-201〜T-207, T-209 | 認証・セッション・ログイン・新規登録・再認証・アクセス日 | ✅ | BE-A | |
| T-208 | 保護者のパスワード再設定 | ✅ | BE-A | `SENDGRID_API_KEY` の設定（未設定ならログ出力のみ） |
| T-210 | 利用規約・プライバシーポリシー画面 | 🟡 | FE | 仮の文面。正式版は T-1008 |
| T-301〜T-305 | 子どもアカウント・設定・問い合わせ | ✅ | BE-A / FE | 問い合わせの転送先 `INQUIRY_TO_EMAIL`【保留 BQ-09】 |
| T-401〜T-407 | ミッション（状態遷移・作成・一覧・編集・取り下げ・画面） | ✅ | BE-B / FE | |
| T-501〜T-516 | 申請・承認・直接登録・レベル・ホーム・きろく | ✅ | BE-B / FE | |
| T-601〜T-605, T-607 | 署名付きURL・アップロード・動画申請・変換・プレーヤー | ✅ | BE-B / FE | |
| T-606 | 動画変換のインフラ（Cloud Run・Eventarc・ライフサイクル） | ⬜ | BE-A | |
| T-608 | 動画変換のテスト | 🟡 | BE-B | 2026-10-24：ffmpeg 9.0.2 で、HEVC・縦向き（回転情報つき含む）・65秒・位置情報つきの合成動画を確認済み（H.264 720x1280・60秒で打ち切り・位置情報なし。30秒の動画で変換約6秒）。実機で撮った動画と Android での再生は未確認 |
| T-701 | アバター素材制作 | 🟡 | FE（デザイン） | `npm run avatars:generate` の仮素材38点。本番素材に差し替える【保留 Q-11, BQ-12】 |
| T-702 | assets の配信（CDN） | ⬜ | BE-A | |
| T-703〜T-707 | アバター描画・マスタAPI・アバターAPI・着せ替え・レベルアップ演出 | ✅ | BE-B / FE | |
| T-801 | バッチ基盤 | 🟡 | BE-A | `jobs/run.ts` は実装済み。Cloud Scheduler ＋ Cloud Run Jobs の設定 |
| T-802〜T-806 | 各バッチ | ✅ | BE-A | |
| T-901 | セキュリティヘッダ | 🟡 | BE-A | CSP の `script-src` に `'unsafe-inline'` が残っている（Next.js のため）。nonce 化を検討 |
| T-902 / T-903 / T-906 / T-907 | Sentry・ログ保存期間・バックアップ・運用手順書 | ⬜ | BE-A | |
| T-904 | ヘルスチェック・監視 | 🟡 | BE-A | `/api/health` は実装済み。Cloud Monitoring のアラート【保留 BQ-16】 |
| T-905 | メンテナンス表示 | ✅ | FE | `MAINTENANCE_MODE=on` / `MAINTENANCE_NOTICE` |
| T-1001 | 認可のテスト | 🟡 | BE-B | `tests/api-flow.test.ts` に主要APIの404テストあり。全エンドポイントに広げる |
| T-1002 | 同時実行のテスト | ✅ | BE-B | 二重承認、承認と差し戻し、申請と直接登録 |
| T-1003 | E2Eテスト | 🟡 | FE | `e2e/flow.mjs`（登録→子ども作成→ミッション→申請→承認→レベルアップ→直接登録）。動画申請・差し戻しを足す |
| T-1004〜T-1007, T-1009 | アクセシビリティ・性能・実機確認・脆弱性診断・リリース | ⬜ | FE / BE-A | |

## 設計書との差分（基本設計書に反映が必要）

| No. | 内容 | 理由 |
|---|---|---|
| 1 | ローカル開発の動画保存を fake-gcs-server ではなく `.storage/`（`STORAGE_DRIVER=local`）にした | Docker がなくても開発できるようにするため。本番は Cloud Storage |
| 2 | 動画変換が申請より先に終わった場合、動画は `READY` のまま申請に紐づく。F-BAT-03 は `status='UPLOADING'` ではなく `submission_id IS NULL` で放置アップロードを判定する | 1.6.2 の順番どおりだと、変換が先に終わったときに申請時の `PROCESSING` 更新で `READY` が上書きされてしまうため |
| 3 | `videos.attempt_count` 列を追加した | 「3回失敗したら FAILED」を判定するため |
| 4 | ミッションの期限日を編集したら、期限切れのチャレンジを挑戦中に戻す | 期限を延ばしても、期限切れになった子が挑戦できないままになるため（2026-10-24 ユーザ確認済み） |
| 5 | 再認証（`/auth/reauth`）にもログインと同じIP制限をかけ、`login_events` に記録する | 共用端末で子どもにパスワードを試されないようにするため |
| 6 | 変換が終わったら、元動画（videos-raw）をすぐ消す（ライフサイクルの1日削除に加えて） | 元動画には撮影場所などのメタデータが残るため |
| 7 | 論理削除した子どもアカウントも29日後に物理削除する（F-BAT-04） | 基本設計書 2.2 の「家族・ユーザのデータ」に合わせた |
| 8 | セッションの Cookie をロールごとに分けた（`sid_parent` / `sid_child`。`role` Cookie は廃止）。どちらのロールでも呼べる API（`/me`、ログアウト）は、画面が `X-Session-Role` ヘッダでどちらを使うかを伝える。子どもが保護者用 API を呼んだときは 403 ではなく 401。子どもの画面で子どもが未ログインなら、保護者がログイン中でもログイン画面へ（保護者のホームには移さない） | 同じブラウザで保護者のタブと子どものタブを並べて使えるようにするため（2026-10-24 ユーザ要望）。影響：共用端末では、子どもがログインしても保護者のログインが残る（承認・子どもの追加などは再認証が必要）【Q-07 / RK-01 と合わせて要確認】 |
