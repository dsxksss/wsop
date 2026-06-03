import { Switch as RSwitch } from "radix-ui";

/** 基于 Radix Switch 的开关。 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="w-9 h-5 rounded-full bg-zinc-700 data-[state=checked]:bg-emerald-500 transition-colors relative outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
    >
      <RSwitch.Thumb className="block w-4 h-4 rounded-full bg-white shadow translate-x-0.5 data-[state=checked]:translate-x-[18px] transition-transform" />
    </RSwitch.Root>
  );
}
