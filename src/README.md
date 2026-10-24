# 子どもを外で遊ばせるアプリ（仮称：そとあそびミッション）

保護者が運動ミッションを設定し、子ども（小学1〜3年生）が外で挑戦して達成を報告し、保護者が承認するとレベルアップ・アバターのパーツが解放されるWebアプリです。

- 設計資料：`../docs/`（要件定義書・基本設計書・実装タスクリスト）
- 3人での分担と進め方：[CONTRIBUTING.md](CONTRIBUTING.md)

## 必要なもの

- Node.js 22 以上
- PostgreSQL 16（次のどちらか）
  - Docker がある場合：`docker compose up -d`
  - Docker がない場合：`npm run db:local`（embedded-postgres。別のターミナルで起動したままにする）

## はじめかた

```bash
npm install
cp .env.example .env          # Windows は copy .env.example .env
npm run db:local              # または docker compose up -d（別ターミナル）
npm run db:setup              # マイグレーション＋マスタデータ投入
SEED_DEMO=1 npm run db:seed   # （任意）デモ用の家族・ミッションを作る
npm run dev                   # http://localhost:3000
```

デモデータを入れた場合のアカウント：

| ロール | ユーザID | パスワード |
|---|---|---|
| 保護者 | demo_parent | demo1234 |
| 子ども | demo_taro / demo_hana | 123456 |

## ローカル環境でデモする（本番モード）

発表のデモは、PC 1台で本番モード（`npm start`）を動かし、そのPCのブラウザで http://localhost:3000 を開いて行う。外部への公開（サーバーやトンネル）はしない。

開発モード（`npm run dev`）との違い：

- 画面が速い。開発用の表示（Next.js のエラー表示など）も出ない
- ffmpeg がないと動画の申請が失敗する（開発モードでは変換せずにコピーするので動く）
- `.env` の `IP_HASH_SECRET` と `STORAGE_LOCAL_SECRET` が必須になる

以下は Windows（PowerShell）の手順。macOS・Linux でも、コマンドはそのまま使える。

### 1. 初回だけ：準備

「はじめかた」の `npm run db:setup` まで済ませてから、次の準備をする。

**ffmpeg を入れる**（iPhone の動画を Android でも再生できるように変換するため）

```powershell
winget install --id Gyan.FFmpeg -e
```

PowerShell を開き直して `ffmpeg -version` が動けば、追加の設定はいらない。動かない場合は、`.env` に ffmpeg.exe と ffprobe.exe の場所を書く。

```
FFMPEG_PATH="C:/Users/<ユーザ名>/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-<版>-full_build/bin/ffmpeg.exe"
FFPROBE_PATH="（同じフォルダの）ffprobe.exe"
```

**`.env` の秘密値を変える**：`IP_HASH_SECRET` と `STORAGE_LOCAL_SECRET` を、`change-me` から推測されにくい長い文字列に変える。次のコマンドで作れる。

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

**デモデータを入れる**（まだ入れていない場合）

```powershell
$env:SEED_DEMO=1; npm run db:seed
```

### 2. 起動する

PowerShell を2つ開き、どちらも `src/` に移動してから実行する。

```powershell
# 1つめ：データベース（起動したままにしておく）
npm run db:local

# 2つめ：アプリ
npm run build   # 初回と、コードを変えたあとだけ
npm start       # http://localhost:3000
```

ブラウザで http://localhost:3000 を開き、上のデモ用アカウントでログインする。

### 3. 止める

それぞれの PowerShell で Ctrl+C を押す。データは `.pgdata/`（DB）と `.storage/`（動画）に残るので、次に起動するとそのまま使える。

### デモの前に確認すること

- [ ] PC のスリープを切っておく（スリープするとアプリと DB が止まる）
- [ ] 保護者・子どもでログインできる
- [ ] 動画ミッションの申請が「確認待ち」になり、保護者の画面で再生できる（ffmpeg が動いているかの確認）
- [ ] `npm run e2e` が `OK: all steps passed` で終わる（アプリを起動したまま、別の PowerShell で実行する。初回は `npx playwright install chromium` が必要）

### うまく動かないとき

| 症状 | 対処 |
|---|---|
| `npm` が見つからない | PowerShell を開き直す。それでもだめなら Node.js 22 を入れる（`winget install OpenJS.NodeJS.LTS`） |
| `npm start` で「環境変数 … が設定されていません」 | `.env` の `IP_HASH_SECRET` と `STORAGE_LOCAL_SECRET` を確認する |
| 画面がエラーになる、ログインできない | `npm run db:local` を起動しているか確認する（ポート 54329） |
| 動画が「失敗」になる | ffmpeg が動くか（`ffmpeg -version`）、`.env` の `FFMPEG_PATH` を確認する |
| 同じ Wi-Fi のスマホから `http://192.168.x.x:3000` を開くとログインできない | 本番モードでは、ログイン情報（Cookie）を https でしか送らない設定のため。デモは PC のブラウザで行う |
| テストで作ったユーザが残っていて邪魔 | DB を止めて `.pgdata/` を消し、`npm run db:local` → `npm run db:setup` → デモデータの投入をやり直す |

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run lint` / `npm run typecheck` | ESLint / 型チェック |
| `npm test` | テスト（単体＋APIの結合テスト。DBが起動していて `db:setup` 済みであること） |
| `npm run build` | 本番ビルド |
| `npm start` | 本番モードで起動（先に `npm run build`） |
| `npm run e2e` | ブラウザでの通しテスト（起動中の http://localhost:3000 に対して実行） |
| `npm run db:migrate` | マイグレーションの適用 |
| `npm run db:seed` | マスタデータの投入（何度実行してもよい） |
| `npm run jobs -- <job>` | バッチの実行（`expire-challenges` / `delete-videos` / `cleanup-uploads` / `purge-deleted` / `cleanup-misc`） |
| `npm run transcoder` | 動画変換サービス（本番用。開発ではアップロード時に自動で動く） |
| `npm run avatars:generate` | 仮のアバター素材を `public/avatars/` に生成 |

## ディレクトリ構成（基本設計書 1.4）

```
app/                 画面（Next.js App Router）と API（app/api/v1）
  login, signup, password-reset, terms, privacy   S-01〜S-05
  parent/...         保護者画面 P-01〜P-09
  kids/...           子ども画面 C-01〜C-07
  api/v1/...         REST API（各ファイルは薄く、処理は server/services に書く）
  api/dev-storage    開発用ストレージ（STORAGE_DRIVER=local のときだけ動く）
components/          画面部品（ui.tsx が共通部品、parent/・kids/ が画面別）
lib/                 画面とサーバで共通：constants（区分値）, schemas（入力チェック）, types（APIの型）, date
server/
  http.ts            API共通基盤（エラー形式・CSRF・セッション確認）
  auth/              パスワード・セッション・再認証・IP制限
  domain/            状態遷移（challenge.ts）とレベル計算（level.ts）。ここ以外で状態やレベルを変えない
  repositories/      家族単位で絞り込んだ取得（他の家族のデータは404）
  services/          業務ロジック（API と バッチ から呼ぶ）
  storage/           オブジェクトストレージ（local / gcs）
jobs/                バッチのエントリポイント
transcoder/          動画変換サービス（Cloud Run 用の別コンテナ）
prisma/              スキーマ・マイグレーション（CHECK制約などはSQLに直接書く）・シード
tests/               単体テスト・APIの結合テスト
```

## 開発環境と本番の違い

| 項目 | 開発（既定） | 本番・staging |
|---|---|---|
| 動画の保存 | `.storage/`（`STORAGE_DRIVER=local`） | Cloud Storage（`STORAGE_DRIVER=gcs`） |
| 動画の変換 | アップロード完了時に同じプロセスで実行。ffmpeg がなければ変換せずコピー | Eventarc → `transcoder/`（ffmpeg） |
| メール | ログに出すだけ | SendGrid（`SENDGRID_API_KEY`） |
| アバター画像 | `public/avatars/` | assets バケット＋Cloud CDN（`NEXT_PUBLIC_ASSETS_BASE_URL`） |

## Docker イメージ

```bash
docker build -t web .                                   # 画面＋API（バッチも同じイメージ）
docker build -f transcoder/Dockerfile -t transcoder .   # 動画変換
```
