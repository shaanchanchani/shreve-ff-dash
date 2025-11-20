import { HistoryWidgets } from "@/components/history/history-widgets";
import { basePalette, fontVariableClasses } from "@/lib/theme";

export default function HistoryPage() {
  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-hidden bg-black text-[var(--mist)]"
      >
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 pb-24 pt-5">
          <HistoryWidgets />
        </div>
      </main>
    </div>
  );
}
