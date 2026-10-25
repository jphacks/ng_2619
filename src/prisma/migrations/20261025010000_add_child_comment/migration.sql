-- 子どもが動画・目視の達成報告に添える自由コメント。保護者の評価コメントとは分けて保存する。
ALTER TABLE submissions ADD COLUMN child_comment varchar(200);
