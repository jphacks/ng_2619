-- 既存の共通カテゴリは過去ミッション用に維持し、新しいカテゴリは家族ごとに管理する。
ALTER TABLE mission_categories ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX mission_categories_family_id_label_key ON mission_categories(family_id, label);
