import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { marked } from "marked";
import {
  Bold,
  Code,
  Eye,
  Heading2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  X,
} from "lucide-react";

/**
 * Markdown 源码编辑器 / 渲染器（维护记录 content / result / notes 共用）。
 *
 * - 编辑区是纯 Markdown 源码（textarea），不做所见即所得；聚焦时左侧滑出预览面板渲染结果。
 * - 图片以 base64 内联：粘贴 / 拖入 / 选文件统一压缩后插入 `![](data:...)`。
 * - 存储为 Markdown 源码，配合后端 *_format='markdown' 标记区分历史纯文本 / 旧 HTML。
 */

const MAX_IMAGE_DIM = 1600; // 长边像素上限
const JPEG_QUALITY = 0.82;

// 预览面板尺寸 / dialog 让位距离（像素）。
const PREVIEW_W = 380;
const PREVIEW_GAP = 14;
const DIALOG_SHIFT = 200;

marked.setOptions({ gfm: true, breaks: true });

// 同一时刻只允许一个预览面板：切换编辑器时立即关掉上一个，避免面板叠加。
let activePreviewCloser: (() => void) | null = null;
// 每个 dialog 上「正打开的预览」计数：归零才把 dialog 复位，避免多编辑器互相把让位顶回去。
const dialogShiftCount = new WeakMap<HTMLElement, number>();

/** Markdown → HTML。内容来自内部受信任的运维人员，直接渲染。 */
function mdToHtml(md: string): string {
  return marked.parse(md) as string;
}

// 完整 Markdown（含 base64）↔ 紧凑显示串（图片以 img://N 短占位呈现）。
// 让编辑区不被超长 base64 撑爆，存储 / 预览仍用真正的 base64。
function contractImages(full: string): { display: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let n = 0;
  const display = full.replace(/(!\[[^\]]*\]\()(data:[^)\s]+)(\))/g, (_m, pre, url, post) => {
    n += 1;
    const id = String(n);
    map.set(id, url);
    return `${pre}img://${id}${post}`;
  });
  return { display, map };
}

function expandImages(display: string, map: Map<string, string>): string {
  return display.replace(/(!\[[^\]]*\]\()img:\/\/([^)\s]+)(\))/g, (whole, pre, id, post) => {
    const url = map.get(id);
    return url ? `${pre}${url}${post}` : whole;
  });
}

/** 把图片文件压缩为内联 data URL（降分辨率 + JPEG 编码）。 */
async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("图片解码失败"));
    el.src = dataUrl;
  });

  const { width, height } = img;
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(width, height));
  if (scale === 1 && dataUrl.length < 400_000) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return out.length < dataUrl.length ? out : dataUrl;
}

/** 从剪贴板 / 拖拽数据里挑出图片文件（兼容只在 items 暴露位图的截图工具）。 */
function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files = Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
  if (files.length > 0) return files;
  const out: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** 内容是否「视觉为空」（无文字且无图片），用于禁用提交。 */
export function isRichTextEmpty(src: string | null | undefined): boolean {
  return !src || src.trim().length === 0;
}

function ToolbarButton({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // 保住 textarea 焦点与选区
      onClick={onClick}
      className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-emerald-500/20 text-emerald-300"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "在此记录维护细节（支持 Markdown），可直接粘贴截图…",
  minHeight = 140,
}: {
  value: string;
  onChange: (src: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 工具栏改写源码后，待恢复的选区（受控更新后在 layout effect 里应用）。
  const pendingSel = useRef<[number, number] | null>(null);
  // 编辑区只显示紧凑串（图片 = img://N），base64 收进 mapRef；
  // 对外 onChange 始终发完整 Markdown，所以存储 / 预览拿到真正的 base64。
  const [boot] = useState(() => contractImages(value || ""));
  const [display, setDisplay] = useState(boot.display);
  const mapRef = useRef(boot.map);
  const idRef = useRef(boot.map.size);
  const lastEmitted = useRef(value || "");
  // 聚焦时让 dialog 往左让位、在其右侧滑出的只读预览面板。
  const [previewOpen, setPreviewOpen] = useState(false);
  const [panel, setPanel] = useState<{ left: number; top: number; height: number } | null>(null);
  // 失焦延时关闭句柄：吸收聚焦时的瞬时 blur→focus 抖动。
  const closeTimer = useRef<number | null>(null);

  const closePreview = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (activePreviewCloser === closePreview) activePreviewCloser = null;
    setPreviewOpen(false);
  }, []);
  const openPreview = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    // 立即关掉其它编辑器的预览，保证同一时刻只有一个。
    if (activePreviewCloser && activePreviewCloser !== closePreview) activePreviewCloser();
    activePreviewCloser = closePreview;
    setPreviewOpen(true);
  }, [closePreview]);
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => closePreview(), 140);
  }, [closePreview]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (activePreviewCloser === closePreview) activePreviewCloser = null;
    },
    [closePreview],
  );

  // 提交一次编辑：更新紧凑显示串，并把 base64 还原回完整 Markdown 抛给父级。
  const emitDisplay = useCallback(
    (nextDisplay: string) => {
      setDisplay(nextDisplay);
      const full = expandImages(nextDisplay, mapRef.current);
      lastEmitted.current = full;
      onChange(full);
    },
    [onChange],
  );

  // 外部 value 变化（加载已有记录 / 提交后清空）时，重建紧凑显示与映射。
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const { display: d, map } = contractImages(value || "");
    mapRef.current = map;
    idRef.current = map.size;
    lastEmitted.current = value || "";
    setDisplay(d);
  }, [value]);

  // 受控更新后恢复工具栏操作前的选区。
  useLayoutEffect(() => {
    if (pendingSel.current && taRef.current) {
      const [s, e] = pendingSel.current;
      taRef.current.focus();
      taRef.current.setSelectionRange(s, e);
      pendingSel.current = null;
    }
  }, [display]);

  // 在光标处包裹选中文本（无选区则插入标记并把光标放中间）。
  const surround = useCallback(
    (before: string, after = before) => {
      const ta = taRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const sel = display.slice(s, e);
      pendingSel.current = [s + before.length, e + before.length];
      emitDisplay(display.slice(0, s) + before + sel + after + display.slice(e));
    },
    [display, emitDisplay],
  );

  // 给选中范围的每一行加前缀（## / - / > 等块级语法）。
  const linePrefix = useCallback(
    (prefix: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const lineStart = display.lastIndexOf("\n", s - 1) + 1;
      const head = display.slice(0, lineStart);
      const block = display.slice(lineStart, e) || "";
      const lines = block.split("\n");
      const prefixed = lines.map((l) => prefix + l).join("\n");
      pendingSel.current = [s + prefix.length, e + prefix.length * lines.length];
      emitDisplay(head + prefixed + display.slice(e));
    },
    [display, emitDisplay],
  );

  // 压缩图片、把 base64 收进映射，仅在光标处插入短占位 `![](img://N)`。
  const insertImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const ids: string[] = [];
      for (const f of files) {
        try {
          const url = await compressImageFile(f);
          idRef.current += 1;
          const id = String(idRef.current);
          mapRef.current.set(id, url);
          ids.push(id);
        } catch {
          /* 跳过解码失败的图片 */
        }
      }
      if (ids.length === 0) return;
      const ta = taRef.current;
      const pos = ta ? ta.selectionStart : display.length;
      const snippet = ids.map((id) => `![](img://${id})`).join("\n");
      pendingSel.current = [pos + snippet.length, pos + snippet.length];
      emitDisplay(display.slice(0, pos) + snippet + display.slice(pos));
    },
    [display, emitDisplay],
  );

  // dialog 让位的缓动与 0px 基线（挂载时设好；relative 的 left 默认 auto，
  // auto→长度 不可过渡会跳变，先有 0px 基线首次展开才平滑）。
  useLayoutEffect(() => {
    const dialog = wrapRef.current?.closest<HTMLElement>(".wsop-dialog-content");
    if (dialog) {
      dialog.style.transition = "left 0.42s cubic-bezier(0.22, 1, 0.36, 1)";
      if (!dialog.style.left) dialog.style.left = "0px";
    }
  }, []);

  // 预览开合：把所在 dialog 往左挪 DIALOG_SHIFT 让位，面板贴到其右缘。
  // 引用计数协调同一 dialog 上的多个编辑器：只有最后一个关闭时才复位，
  // 切换编辑器时 dialog 保持偏移、不回弹（设值幂等，无重复动画）。
  // 用 position:relative 的 left（非 transform），不破坏 fixed 子元素定位，也不被 Radix 当成「点击外部」。
  useLayoutEffect(() => {
    const dialog = wrapRef.current?.closest<HTMLElement>(".wsop-dialog-content");
    if (!dialog || !previewOpen) return;

    dialogShiftCount.set(dialog, (dialogShiftCount.get(dialog) ?? 0) + 1);
    dialog.style.left = `-${DIALOG_SHIFT}px`;

    const measure = () => {
      const r = dialog.getBoundingClientRect();
      // dialog 在视口水平居中，自然右缘只跟宽度有关，与当前 left 偏移 / 过渡进度无关
      // —— 避免在 transition 中途测到旧位置而把面板算偏（间距异常）。
      const naturalRight = window.innerWidth / 2 + r.width / 2;
      const maxLeft = window.innerWidth - PREVIEW_W - 8;
      setPanel({
        left: Math.min(naturalRight - DIALOG_SHIFT + PREVIEW_GAP, maxLeft),
        top: r.top,
        height: r.height,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      const c = (dialogShiftCount.get(dialog) ?? 1) - 1;
      dialogShiftCount.set(dialog, c);
      if (c <= 0) dialog.style.left = "0px";
    };
  }, [previewOpen]);

  return (
    <>
      <div
        ref={wrapRef}
        className="rounded-xl bg-zinc-950/40 border border-zinc-800/60 focus-within:border-emerald-500/50 transition-colors overflow-hidden"
      >
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-zinc-800/60 flex-wrap">
          <ToolbarButton title="加粗" onClick={() => surround("**")}>
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton title="斜体" onClick={() => surround("*")}>
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton title="删除线" onClick={() => surround("~~")}>
            <Strikethrough size={15} />
          </ToolbarButton>
          <div className="w-px h-4 bg-zinc-800/80 mx-1" />
          <ToolbarButton title="标题" onClick={() => linePrefix("## ")}>
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton title="无序列表" onClick={() => linePrefix("- ")}>
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton title="有序列表" onClick={() => linePrefix("1. ")}>
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton title="引用" onClick={() => linePrefix("> ")}>
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarButton title="行内代码" onClick={() => surround("`")}>
            <Code size={15} />
          </ToolbarButton>
          <div className="w-px h-4 bg-zinc-800/80 mx-1" />
          <ToolbarButton title="插入图片" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon size={15} />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              insertImages(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <div className="ml-auto" />
          <ToolbarButton
            title="预览渲染效果"
            active={previewOpen}
            onClick={() => (previewOpen ? closePreview() : openPreview())}
          >
            <Eye size={15} />
          </ToolbarButton>
        </div>
        <textarea
          ref={taRef}
          value={display}
          onChange={(e) => emitDisplay(e.target.value)}
          onFocus={openPreview}
          onBlur={scheduleClose}
          placeholder={placeholder}
          spellCheck={false}
          style={{ minHeight }}
          className="w-full bg-transparent text-sm text-zinc-100 font-mono-data leading-relaxed px-3 py-2.5 outline-none resize-y placeholder:text-zinc-600"
          onPaste={(e) => {
            const files = imageFilesFrom(e.clipboardData);
            if (files.length > 0) {
              e.preventDefault();
              insertImages(files);
            }
          }}
          onDrop={(e) => {
            const files = imageFilesFrom(e.dataTransfer);
            if (files.length > 0) {
              e.preventDefault();
              insertImages(files);
            }
          }}
        />
      </div>

      {/* 贴着 dialog 右侧、从左往右果冻弹出的只读预览面板（dialog 同时左移让位）。 */}
      <AnimatePresence>
        {previewOpen && panel && (
          <motion.div
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            initial={{ scaleX: 0, scaleY: 0.82, opacity: 0, filter: "blur(8px)" }}
            animate={{ scaleX: 1, scaleY: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scaleX: 0, scaleY: 0.82, opacity: 0, filter: "blur(8px)" }}
            transition={{
              type: "spring",
              bounce: 0.32,
              duration: 0.5,
              opacity: { duration: 0.14 },
              filter: { duration: 0.22 },
            }}
            style={{
              position: "fixed",
              left: panel.left,
              top: panel.top,
              height: panel.height,
              width: PREVIEW_W,
              transformOrigin: "left center",
              willChange: "transform",
            }}
            className="z-[70] overflow-hidden rounded-2xl border border-zinc-800/70 bg-[#0c0f15] backdrop-blur-md shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Eye size={14} className="text-emerald-400" />
                渲染预览
              </span>
              <button
                type="button"
                title="收起"
                onClick={() => {
                  closePreview();
                  taRef.current?.blur();
                }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3.5">
              {value ? (
                <RichTextContent html={value} format="markdown" />
              ) : (
                <p className="text-xs text-zinc-600">（暂无内容）</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** 只读渲染：markdown → 渲染；html → 旧富文本；其余 → 纯文本（保留换行）。 */
export function RichTextContent({
  html,
  format,
  className = "",
}: {
  html: string;
  format: string;
  className?: string;
}) {
  const [zoom, setZoom] = useState<string | null>(null);

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") setZoom((target as HTMLImageElement).src);
  };

  // 'html' = 旧 TipTap 富文本，按原样渲染；其余（markdown / text / 后端未返回 format）
  // 一律按 Markdown 渲染，避免内容显示成原始源码 / base64。
  const rendered = format === "html" ? html : mdToHtml(html);

  return (
    <>
      <div
        className={`rich-content ${className}`}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
      {/* 放大层 portal 到 body：避免被预览面板的 transform 限制成相对定位。 */}
      {zoom &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-8 cursor-zoom-out"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setZoom(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 hover:text-white"
              onClick={() => setZoom(null)}
            >
              <X size={18} />
            </button>
            <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>,
          document.body,
        )}
    </>
  );
}
