import { useEffect, useState } from "react";
import { Download, FileQuestion } from "lucide-react";
import type { CustomerFile } from "@wsop/shared";
import { downloadBlob } from "../../lib/api";
import { fmtSize } from "../../lib/format";
import { Modal } from "../ui/Modal";
import { Button, Spinner } from "../ui/primitives";

type Kind = "image" | "pdf" | "text" | "other";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "avif"];
const TEXT_EXT = [
  "txt", "md", "markdown", "json", "csv", "tsv", "log", "xml", "yaml", "yml",
  "js", "ts", "tsx", "jsx", "css", "scss", "html", "htm", "sh", "bash", "rs",
  "toml", "ini", "conf", "cfg", "env", "sql", "py", "go", "java", "c", "cpp",
  "h", "rb", "php", "properties", "gitignore", "dockerfile",
];

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 超过 2MB 不做文本预览，避免卡顿

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

function classify(file: CustomerFile): Kind {
  const mime = (file.mime_type ?? "").toLowerCase();
  const e = ext(file.filename);
  if (mime.startsWith("image/") || IMAGE_EXT.includes(e)) return "image";
  if (mime === "application/pdf" || e === "pdf") return "pdf";
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    TEXT_EXT.includes(e)
  )
    return "text";
  return "other";
}

export function FileViewerModal({
  open,
  onClose,
  file,
}: {
  open: boolean;
  onClose: () => void;
  file: CustomerFile;
}) {
  const kind = classify(file);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setText(null);
      setObjectUrl(null);
      if (kind === "other") {
        setLoading(false);
        return;
      }
      try {
        const blob = await downloadBlob(`/files/${file.id}/download`);
        if (cancelled) return;
        if (kind === "text") {
          if (blob.size > MAX_TEXT_BYTES) {
            setError("文件较大，不便在线预览，请下载查看。");
          } else {
            setText(await blob.text());
          }
        } else {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (open) run();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, file.id, kind]);

  const onDownload = async () => {
    try {
      const blob = await downloadBlob(`/files/${file.id}/download`);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.filename}
      width="max-w-4xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-zinc-500 font-mono-data">
            {fmtSize(file.size_bytes)} · {file.mime_type ?? "未知类型"}
          </span>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          <Button icon={<Download size={13} />} onClick={onDownload}>
            下载
          </Button>
        </>
      }
    >
      {(() => {
        const isText = !loading && !error && kind === "text" && text !== null;
        return (
          <div
            className={`min-h-[40vh] flex ${
              isText ? "flex-col" : "items-center justify-center"
            }`}
          >
            {loading ? (
              <Spinner />
            ) : error ? (
              <div className="text-sm text-red-400">{error}</div>
            ) : kind === "image" && objectUrl ? (
              <img
                src={objectUrl}
                alt={file.filename}
                className="max-w-full max-h-[68vh] rounded-lg object-contain"
              />
            ) : kind === "pdf" && objectUrl ? (
              <iframe
                src={objectUrl}
                title={file.filename}
                className="w-full h-[68vh] rounded-lg border border-zinc-800/60 bg-white"
              />
            ) : isText ? (
              <pre className="w-full text-xs leading-relaxed text-zinc-200 font-mono-data whitespace-pre-wrap break-words m-0">
                {text}
              </pre>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center py-6">
                <FileQuestion size={36} className="text-zinc-600" />
                <div className="text-sm text-zinc-400">该文件类型暂不支持在线预览。</div>
                <Button icon={<Download size={13} />} onClick={onDownload}>
                  下载查看
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </Modal>
  );
}
