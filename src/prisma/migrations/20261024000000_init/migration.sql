-- 基本設計書 4.3 テーブル定義（初版）
-- Prisma のスキーマで表現できない CHECK 制約・部分一意インデックスもここで定義する。

CREATE TABLE families (
  id         uuid PRIMARY KEY,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  deleted_at timestamptz(6)
);

CREATE TABLE users (
  id                  uuid PRIMARY KEY,
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role                text NOT NULL CHECK (role IN ('PARENT', 'CHILD')),
  login_id            text NOT NULL CHECK (login_id ~ '^[a-z0-9_]{4,20}$'),
  password_hash       text NOT NULL,
  display_name        varchar(10) NOT NULL CHECK (char_length(display_name) >= 1),
  email               text,
  failed_login_count  smallint NOT NULL DEFAULT 0,
  locked_until        timestamptz(6),
  password_changed_at timestamptz(6) NOT NULL DEFAULT now(),
  created_at          timestamptz(6) NOT NULL DEFAULT now(),
  updated_at          timestamptz(6) NOT NULL DEFAULT now(),
  deleted_at          timestamptz(6),
  CONSTRAINT users_parent_email_required CHECK (role <> 'PARENT' OR email IS NOT NULL)
);
CREATE UNIQUE INDEX users_login_id_key ON users (login_id);
-- 保護者のメールアドレスは一意（BQ-06）
CREATE UNIQUE INDEX users_parent_email_key ON users (email) WHERE role = 'PARENT';
CREATE INDEX users_family_id_idx ON users (family_id);

CREATE TABLE parent_settings (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reauth_required boolean NOT NULL DEFAULT true,
  terms_agreed_at timestamptz(6) NOT NULL,
  terms_version   text NOT NULL
);

CREATE TABLE child_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  grade              smallint NOT NULL CHECK (grade BETWEEN 1 AND 6),
  approved_count     integer NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  level              smallint NOT NULL DEFAULT 1 CHECK (level >= 1),
  last_seen_level    smallint NOT NULL DEFAULT 1,
  avatar_initialized boolean NOT NULL DEFAULT false
);

CREATE TABLE sessions (
  id             text PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz(6) NOT NULL DEFAULT now(),
  last_active_at timestamptz(6) NOT NULL DEFAULT now(),
  expires_at     timestamptz(6) NOT NULL,
  elevated_until timestamptz(6),
  user_agent     text
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz(6) NOT NULL,
  used_at    timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

CREATE TABLE login_events (
  id             bigserial PRIMARY KEY,
  login_id_input text NOT NULL,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  ip_hash        text NOT NULL,
  success        boolean NOT NULL,
  created_at     timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX login_events_ip_hash_created_at_idx ON login_events (ip_hash, created_at);
CREATE INDEX login_events_created_at_idx ON login_events (created_at);

CREATE TABLE activity_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE mission_categories (
  code       text PRIMARY KEY,
  label      text NOT NULL,
  icon_path  text NOT NULL,
  sort_order smallint NOT NULL
);

CREATE TABLE missions (
  id            uuid PRIMARY KEY,
  family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES users(id),
  title         varchar(30) NOT NULL CHECK (char_length(title) >= 1),
  description   varchar(200),
  category_code text NOT NULL REFERENCES mission_categories(code),
  target_value  integer CHECK (target_value BETWEEN 1 AND 9999),
  target_unit   text CHECK (target_unit IN ('TIMES', 'SECONDS', 'MINUTES', 'METERS')),
  verify_method text NOT NULL CHECK (verify_method IN ('VIDEO', 'VISUAL', 'EITHER')),
  due_date      date,
  created_at    timestamptz(6) NOT NULL DEFAULT now(),
  updated_at    timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT missions_target_pair CHECK ((target_value IS NULL) = (target_unit IS NULL))
);
CREATE INDEX missions_family_id_created_at_idx ON missions (family_id, created_at);

CREATE TABLE challenges (
  id            uuid PRIMARY KEY,
  mission_id    uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('OPEN', 'PENDING', 'REJECTED', 'APPROVED', 'EXPIRED', 'ARCHIVED')),
  approved_at   timestamptz(6),
  created_at    timestamptz(6) NOT NULL DEFAULT now(),
  updated_at    timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX challenges_mission_id_child_user_id_key ON challenges (mission_id, child_user_id);
CREATE INDEX challenges_child_user_id_status_idx ON challenges (child_user_id, status);
CREATE INDEX challenges_family_id_status_idx ON challenges (family_id, status);
CREATE INDEX challenges_family_id_approved_at_idx ON challenges (family_id, approved_at);

CREATE TABLE stamps (
  code       text PRIMARY KEY,
  label      text NOT NULL,
  icon_path  text NOT NULL,
  sort_order smallint NOT NULL
);

CREATE TABLE submissions (
  id             uuid PRIMARY KEY,
  challenge_id   uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  source         text NOT NULL DEFAULT 'CHILD' CHECK (source IN ('CHILD', 'PARENT')),
  method         text NOT NULL CHECK (method IN ('VIDEO', 'VISUAL')),
  stamp_code     text REFERENCES stamps(code),
  submitted_at   timestamptz(6) NOT NULL,
  review_result  text CHECK (review_result IN ('APPROVED', 'REJECTED')),
  reviewer_id    uuid REFERENCES users(id),
  review_comment varchar(100),
  reviewed_at    timestamptz(6),
  child_seen_at  timestamptz(6),
  -- 差し戻しのときは理由コメントが必須
  CONSTRAINT submissions_reject_comment_required CHECK (
    review_result IS DISTINCT FROM 'REJECTED'
    OR (review_comment IS NOT NULL AND char_length(review_comment) >= 1)
  ),
  -- 保護者の直接登録（F-APV-08）は、目視・承認済み・判断者ありのレコードとして作る
  CONSTRAINT submissions_parent_source_shape CHECK (
    source <> 'PARENT'
    OR (method = 'VISUAL' AND review_result = 'APPROVED' AND reviewer_id IS NOT NULL)
  )
);
-- 1つのチャレンジに判断待ちの申請は1件まで（二重申請の防止）
CREATE UNIQUE INDEX submissions_one_pending_per_challenge ON submissions (challenge_id) WHERE review_result IS NULL;
CREATE INDEX submissions_challenge_id_submitted_at_idx ON submissions (challenge_id, submitted_at);

CREATE TABLE videos (
  id                  uuid PRIMARY KEY,
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  challenge_id        uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_id       uuid REFERENCES submissions(id) ON DELETE CASCADE,
  status              text NOT NULL CHECK (status IN ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED')),
  raw_object          text NOT NULL,
  converted_object    text,
  content_type        text NOT NULL CHECK (content_type IN ('video/mp4', 'video/quicktime')),
  size_bytes          bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  duration_sec        numeric(5, 1),
  failure_reason      text,
  attempt_count       smallint NOT NULL DEFAULT 0,
  delete_scheduled_at timestamptz(6),
  deleted_at          timestamptz(6),
  created_at          timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX videos_submission_id_key ON videos (submission_id);
CREATE INDEX videos_challenge_id_idx ON videos (challenge_id);
CREATE INDEX videos_delete_scheduled_at_idx ON videos (delete_scheduled_at);

CREATE TABLE level_master (
  level          smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 50),
  required_count integer NOT NULL CHECK (required_count >= 0)
);
CREATE UNIQUE INDEX level_master_required_count_key ON level_master (required_count);

CREATE TABLE avatar_items (
  id           text PRIMARY KEY,
  slot         text NOT NULL CHECK (slot IN ('BG', 'BOTTOM', 'TOP', 'FACE', 'HAIR', 'HAT', 'ITEM')),
  name         text NOT NULL,
  image_path   text NOT NULL,
  unlock_level smallint NOT NULL REFERENCES level_master(level),
  is_none      boolean NOT NULL DEFAULT false,
  sort_order   smallint NOT NULL
);

CREATE TABLE avatar_equips (
  child_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot          text NOT NULL CHECK (slot IN ('BG', 'BOTTOM', 'TOP', 'FACE', 'HAIR', 'HAT', 'ITEM')),
  item_id       text NOT NULL REFERENCES avatar_items(id),
  updated_at    timestamptz(6) NOT NULL DEFAULT now(),
  PRIMARY KEY (child_user_id, slot)
);

CREATE TABLE comment_templates (
  id         serial PRIMARY KEY,
  text       text NOT NULL,
  sort_order smallint NOT NULL
);

CREATE TABLE safety_messages (
  id         serial PRIMARY KEY,
  text       text NOT NULL,
  sort_order smallint NOT NULL
);

CREATE TABLE inquiries (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject    varchar(50) NOT NULL,
  body       varchar(2000) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
