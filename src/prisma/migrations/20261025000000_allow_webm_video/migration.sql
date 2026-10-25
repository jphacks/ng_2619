-- MediaRecorder が WebM を出力するブラウザ（Chrome/Firefox等）に対応する。
ALTER TABLE videos DROP CONSTRAINT videos_content_type_check;
ALTER TABLE videos ADD CONSTRAINT videos_content_type_check
  CHECK (content_type IN ('video/mp4', 'video/quicktime', 'video/webm'));
