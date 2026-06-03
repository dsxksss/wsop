import { useState } from "react";
import { Popover } from "radix-ui";
import { Check, Search, ChevronDown, X } from "lucide-react";
import type { UserOptionDto } from "@wsop/shared";

interface AssigneeSelectorProps {
  users: UserOptionDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AssigneeSelector({
  users,
  selectedIds,
  onChange,
  placeholder = "选择负责人…",
  className = "",
  disabled = false,
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  const displayText = selectedUsers.length > 0
    ? selectedUsers.map((u) => u.username).join("、")
    : placeholder;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full h-10 px-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-sm text-left flex items-center justify-between transition-all hover:bg-zinc-900/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedUsers.length > 0 ? "text-zinc-200" : "text-zinc-500"
          } ${className}`}
        >
          <span className="truncate mr-2">{displayText}</span>
          <div className="flex items-center gap-1.5 shrink-0 text-zinc-500">
            {selectedUsers.length > 0 && (
              <span className="text-[10px] bg-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded-md font-medium">
                {selectedUsers.length}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-64 p-2.5 rounded-2xl border border-zinc-800/70 bg-[#0c0f15] shadow-2xl outline-none flex flex-col gap-2 max-h-[300px]"
        >
          {/* Search bar */}
          <div className="relative flex items-center shrink-0">
            <Search size={13} className="absolute left-2.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索成员..."
              className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs text-white placeholder:text-zinc-600 focus:border-emerald-500/50 outline-none transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5 scrollbar-thin">
            {filteredUsers.length === 0 ? (
              <div className="text-[11px] text-zinc-500 text-center py-4">
                无匹配成员
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggle(u.id)}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center justify-between transition-colors cursor-pointer outline-none select-none ${
                      isSelected
                        ? "bg-emerald-500/10 text-emerald-400 font-medium"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    <span>{u.username}</span>
                    {isSelected && (
                      <Check size={13} className="text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
