import { TeamLogo } from "../common/team-logo";
import { ListFooterButton } from "./list-footer-button";

export interface CondensedTeamItem {
  teamName: string;
  logoURL?: string;
  value?: string;
}

interface CondensedTeamListProps {
  items: CondensedTeamItem[];
  footerLabel: string;
  onFooterClick: () => void;
  emptyMessage: string;
}

export function CondensedTeamList({
  items,
  footerLabel,
  onFooterClick,
  emptyMessage,
}: CondensedTeamListProps) {
  const hasValueColumn = items.some((item) => Boolean(item.value));

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      {items.length > 0 ? (
        <>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full">
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.teamName}
                    className={`hover:bg-white/5 ${index < items.length - 1 ? "border-b border-white/5" : ""}`}
                  >
                    <td className={`p-2 ${hasValueColumn ? "" : "w-full"}`}>
                      <div className="flex items-center gap-1.5">
                        <TeamLogo logoURL={item.logoURL} label={item.teamName} />
                        <span className="font-heading text-[0.5rem] uppercase tracking-wide text-white/80">
                          {item.teamName}
                        </span>
                      </div>
                    </td>
                    {hasValueColumn && (
                      <td className="p-2 text-right">
                        <span className="font-field text-[0.72rem] text-[var(--tide)]">
                          {item.value}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListFooterButton onClick={onFooterClick}>
            {footerLabel}
          </ListFooterButton>
        </>
      ) : (
        <>
          <div className="px-4 py-6 text-center text-xs text-white/60">
            {emptyMessage}
          </div>
          <ListFooterButton onClick={onFooterClick}>
            {footerLabel}
          </ListFooterButton>
        </>
      )}
    </div>
  );
}
