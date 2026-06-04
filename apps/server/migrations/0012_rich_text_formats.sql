-- 富文本支持：为维护内容 / 结果 / 跟进备注增加格式标记列。
-- 'text' = 旧的纯文本（按 whitespace-pre-wrap 渲染）；'html' = TipTap 生成的受控 HTML。
-- 历史数据默认 'text'，保证旧记录的换行与展示不受影响。

ALTER TABLE maintenance_records ADD COLUMN content_format TEXT NOT NULL DEFAULT 'text';
ALTER TABLE maintenance_records ADD COLUMN result_format  TEXT NOT NULL DEFAULT 'text';
ALTER TABLE maintenance_notes   ADD COLUMN note_format     TEXT NOT NULL DEFAULT 'text';
