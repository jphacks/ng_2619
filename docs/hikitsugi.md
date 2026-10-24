# セッション引き継ぎメモ

| 項目 | 内容 |
|---|---|
| 作成日 | 2026-10-24 |
| 対象 | 子どもを外で遊ばせるアプリ（仮称：そとあそびミッション）／JPHACKS 向け |
| 想定読者 | 次の作業セッション（Claude または開発メンバー） |

---

## 1. これまでの流れ

| 順番 | やったこと | 成果物 |
|---|---|---|
| 1 | 要件定義書の作成（プロンプト：`youkennteigisho_pre1.md`） | `docs/youkennteigisho.md`（第1.1版） |
| 2 | 基本設計書の作成（プロンプト：`design.md`） | `docs/kihonsekkeisho.md`（第1.1版） |
| 3 | ユーザ確認による仕様の確定（下の 2章） | 要件定義書・基本設計書に反映済み |
| 4 | 実装タスクリストの作成 | `docs/jissoutasuku.md`（91タスク） |
| 5 | プロダクトの実装（3人チーム：FE 1人・BE 2人） | `src/`（Next.js ＋ PostgreSQL） |
| 6 | Node.js 22 LTS のインストール（winget、v22.23.4） | `C:\Program Files\nodejs` |

## 2. ユーザが確定させた仕様（ここが最新）

| 項目 | 確定内容 |
|---|---|
| 目視申請の流れ（IS-01） | 要件定義書 3.2.2 の図の矢印漏れだった。子どもが「みてもらった」ボタンで申請 → 保護者が承認 |
| 保護者による直接登録（Q-09） | **必要**。F-APV-08 として追加済み（保護者が子どもの申請なしで「達成」を登録） |
| 目視の確認方法 | **両方残す**：①子どもが申請→保護者が承認、②保護者が直接登録。動画は「子どもがアップロード→保護者が確認して承認」 |
| 技術スタック | 指定なし → 基本設計書の提案（Next.js ＋ Google Cloud）で実装した（BQ-01 はまだ正式確定ではない） |
| チーム | 3人（フロントエンド1人、バックエンド2人） |

上記以外の【要確認】（要件定義書 Q-xx、基本設計書 BQ-xx）は、暫定案のまま実装している。

## 3. ファイルの場所

```
jphacks/project/
├── docs/
│   ├── youkennteigisho_pre1.md   要件定義書を作るためのプロンプト
│   ├── youkennteigisho.md        要件定義書 第1.1版
│   ├── design.md                 基本設計書を作るためのプロンプト
│   ├── kihonsekkeisho.md         基本設計書 第1.1版
│   ├── jissoutasuku.md           実装タスクリスト
│   └── hikitsugi.md              このファイル
├── .github/workflows/ci.yml      CI（リポジトリのルートを project/ と想定。src/ がルートなら移動）
└── src/                          プロダクト本体
    ├── README.md                 セットアップ・コマンド・構成
    └── CONTRIBUTING.md           3人の分担・ルール・全タスクの実装状況・設計書との差分
```

> 最初は `jphacks/youkenn/` に置いていたが、ユーザが `jphacks/project/docs/` に移動した。

## 4. 実装の現状

### 4.1 技術構成

- Next.js 15（App Router）＋ React 19 ＋ Tailwind CSS 4 ＋ TypeScript
- Prisma 6 ＋ PostgreSQL 16、Zod 3、Argon2id（`@node-rs/argon2`）
- 認証は自前実装（DBのセッショントークン、Cookie `sid`、画面振り分け用に `role` Cookie）
- 動画：開発は `.storage/` に保存（`STORAGE_DRIVER=local`）、本番は Cloud Storage ＋ `transcoder/`（ffmpeg）
- バージョンは基本設計書に合わせて固定（Next 15 / Prisma 6 / Zod 3）。npm の最新は Next 16・Prisma 7・Zod 4 だが、API が変わっているため上げていない

### 4.2 できていること

- 全画面（S-01〜05、P-01〜09、P-M1/M2、C-01〜07）と全API（約35本）、バッチ5種、動画変換サービス
- テスト：`npm test` で28件すべて成功（単体＋APIの結合テスト：主要な流れ、ロック、CSRF、他家族404、同時実行、動画）
- E2E：`npm run e2e` で、登録→子ども作成→ミッション→申請→承認→レベルアップ→直接登録 が成功（Playwright、スマホ幅）
- 本番ビルド成功（各画面の初回読み込み約110KB）、型チェック・lint 成功

### 4.3 残っていること（詳細は `src/CONTRIBUTING.md` の実装状況表）

| 分類 | 内容 |
|---|---|
| インフラ | GCP 環境構築・CD（T-009, T-010）、動画変換のインフラ（T-606）、CDN（T-702）、Cloud Scheduler（T-801） |
| 運用 | Sentry（T-902）、ログ保存期間（T-903）、監視アラート（T-904）、バックアップ（T-906）、運用手順書（T-907） |
| 品質 | 認可テストを全APIに広げる（T-1001）、E2E に動画・差し戻しを追加（T-1003）、アクセシビリティ・性能・実機・脆弱性診断（T-1004〜1007） |
| 素材 | アバターの本番素材（T-701。いまは仮素材38点、`npm run avatars:generate`） |
| 未検証 | ffmpeg がこのPCにないため、動画は変換せずコピーしている。iPhone の HEVC 動画が Android で再生できるかは未確認（T-608） |

### 4.4 設計書との差分（基本設計書への反映がまだ）

`src/CONTRIBUTING.md` の「設計書との差分」に7件。重要なもの：

1. **設計上の不具合を修正**：動画変換が申請より先に終わると、申請時の `PROCESSING` 更新で `READY` が上書きされる問題。上書きしないようにし、F-BAT-03 の判定を `submission_id IS NULL` に変更した
2. **【要確認】** ミッションの期限日を延ばしたら、期限切れのチャレンジを挑戦中に戻す（設計書に記載なし）
3. ローカルの動画保存を fake-gcs-server ではなく `.storage/` にした（Docker 不要にするため）

## 5. 動かし方

このPCには Docker がないため、DB は embedded-postgres を使う。

```bash
cd jphacks/project/src
npm run db:local      # 別ターミナルで起動したまま（localhost:54329、DB名 kids_outdoor）
npm run dev           # http://localhost:3000
```

- `.env` は `.env.example` からコピー済み（開発用の既定値のみ。秘密情報なし）
- DB はマイグレーション・マスタ投入・デモデータ作成済み（データは `src/.pgdata/`）
- デモアカウント：保護者 `demo_parent` / `demo1234`、子ども `demo_taro` / `123456`、`demo_hana` / `123456`
- テスト・E2E で作ったユーザ（`p_xxxx`、`ui_p_xxxx` など）も同じDBに残っている。消したい場合は `.pgdata/` を削除して `npm run db:local` → `npm run db:setup`
- E2E の初回は `npx playwright install chromium` が必要（このPCではインストール済み）

## 6. 次にやると良いこと（優先順）

1. 基本設計書に 4.4 の差分を反映する（特に 1 と 2。2 はユーザ確認が必要）
2. ユーザに確認：技術スタック（BQ-01）と開発期間（Q-03）。ハッカソンのデモ優先なら、GCP 構築より Vercel ＋ マネージドDB などの簡易構成が早い
3. 共用端末の扱い（Q-07 / RK-01）と動画の保存期間（Q-08 / BQ-19）の確定
4. ffmpeg を入れて動画変換を確認（T-608）、実機確認（T-1006）

## 7. 作業上の注意（次のセッション向け）

- **Bash ツールのヒアドキュメントは、日本語を含む長い内容で `unexpected EOF while looking for matching '` になることがあった**。ファイルは Write ツールで書く
- Git Bash から Node を使う場合、新しいシェルで PATH が通っているか確認する（`node -v`）。PowerShell では `C:\Program Files\nodejs` が使える
- `next start` は使えるが、Docker 用の standalone 出力は `NEXT_OUTPUT=standalone` のときだけ有効（`next.config.ts`）
- `src/` はまだ Git リポジトリになっていない（`git init` していない）
- 文書はすべて日本語。要件定義書・基本設計書の ID（F-xxx、NF-xxx、Q-xx、BQ-xx、DC-xx、RK-xx）をコードのコメントや各文書で共通に使っている
