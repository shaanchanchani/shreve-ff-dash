export const PayoutCardSkeleton = () => (
  <section className="animate-pulse space-y-5">
    <div className="mb-5 flex items-center justify-between">
      <div className="h-6 w-40 rounded bg-white/10" />
    </div>
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <thead className="border-b border-white/10">
          <tr className="text-xs">
            <th className="p-3 text-left">
              <div className="h-4 w-12 rounded bg-white/10" />
            </th>
            <th className="p-3 text-right">
              <div className="ml-auto h-4 w-8 rounded bg-white/10" />
            </th>
            <th className="p-3 text-right">
              <div className="ml-auto h-4 w-8 rounded bg-white/10" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, index) => (
            <tr
              key={index}
              className={`border-white/5 ${index < 7 ? "border-b" : ""}`}
            >
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-white/10" />
                  <div className="h-4 w-20 rounded bg-white/10" />
                </div>
              </td>
              <td className="p-3 text-right">
                <div className="ml-auto h-6 w-12 rounded bg-white/10" />
              </td>
              <td className="p-3 text-right">
                <div className="ml-auto h-6 w-12 rounded bg-white/10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const LeagueCardSkeleton = () => (
  <section className="animate-pulse space-y-5">
    <div className="mb-5 flex flex-col gap-3">
      <div className="h-6 w-48 rounded bg-white/10" />
      <div className="h-32 rounded-2xl border border-white/10 bg-[var(--surface)]" />
    </div>
    <div className="mb-3 h-5 w-40 rounded bg-white/10" />

    <div className="mb-5 rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 3 }, (_, index) => (
            <tr
              key={index}
              className={`border-white/5 ${index < 2 ? "border-b" : ""}`}
            >
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-white/10" />
                  <div className="h-4 w-24 rounded bg-white/10" />
                </div>
              </td>
              <td className="p-2 text-right">
                <div className="h-4 w-12 rounded bg-white/10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="h-5 w-40 rounded bg-white/10" />
    <div className="mt-3 rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 3 }, (_, index) => (
            <tr
              key={index}
              className={`border-white/5 ${index < 2 ? "border-b" : ""}`}
            >
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-white/10" />
                  <div className="space-y-1">
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="h-3 w-16 rounded bg-white/10" />
                  </div>
                </div>
              </td>
              <td className="p-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="h-6 w-8 rounded bg-white/10" />
                  <div className="h-4 w-12 rounded bg-white/10" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const WeeklySurvivorSkeleton = () => (
  <section className="animate-pulse space-y-8">
    <div className="mb-3 h-4 w-32 rounded bg-white/10" />
    <div className="mt-6">
      <div className="mb-3 h-5 w-40 rounded bg-white/10" />
      <div className="rounded-xl border border-white/10 bg-[var(--surface)]">
        <table className="w-full">
          <tbody>
            {Array.from({ length: 3 }, (_, index) => (
              <tr
                key={index}
                className={`${index < 2 ? "border-b border-white/5" : ""}`}
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-white/10" />
                    <div className="h-4 w-24 rounded bg-white/10" />
                  </div>
                </td>
                <td className="p-2 text-right">
                  <div className="ml-auto h-6 w-12 rounded bg-white/10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 h-11 rounded-full border border-white/10 bg-[var(--surface)]" />
    </div>
    <div className="my-8 h-px w-full bg-white/10" />
    <div>
      <div className="mb-3 h-5 w-36 rounded bg-white/10" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--surface)] px-4 py-3"
          >
            <div className="h-9 w-9 rounded-full bg-white/10" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 rounded bg-white/10" />
              <div className="h-3 w-16 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 h-11 rounded-full border border-white/10 bg-[var(--surface)]" />
    </div>
  </section>
);

export const WeeklyBreakdownSkeleton = () => (
  <section className="animate-pulse space-y-5">
    <div className="mb-3 h-4 w-32 rounded bg-white/10" />
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 6 }, (_, index) => (
            <tr
              key={index}
              className={`${index < 5 ? "border-b border-white/5" : ""}`}
            >
              <td className="p-3">
                <div className="h-4 w-8 rounded bg-white/10" />
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-white/10" />
                  <div className="h-4 w-24 rounded bg-white/10" />
                </div>
              </td>
              <td className="p-3 text-right">
                <div className="ml-auto h-6 w-12 rounded bg-white/10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const SurvivorCardSkeleton = () => (
  <section className="animate-pulse space-y-6">
    <div className="mb-4 flex items-center justify-between">
      <div className="h-6 w-32 rounded bg-white/10" />
      <div className="h-6 w-8 rounded bg-white/10" />
    </div>
    <div className="mb-6 h-4 w-3/4 rounded bg-white/10" />
    <div className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 8 }, (_, index) => (
            <tr
              key={index}
              className={`${index < 7 ? "border-b border-white/5" : ""}`}
            >
              <td className="p-2">
                <div className="h-4 w-12 rounded bg-white/10" />
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="mb-1 h-4 w-20 rounded bg-white/10" />
                    <div className="h-3 w-16 rounded bg-white/10" />
                  </div>
                </div>
              </td>
              <td className="p-2 text-right">
                <div className="ml-auto h-5 w-6 rounded bg-white/10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mb-3 h-5 w-36 rounded bg-white/10" />
    <div className="max-h-40 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 4 }, (_, index) => (
            <tr
              key={index}
              className={`${index < 3 ? "border-b border-white/5" : ""}`}
            >
              <td className="p-2">
                <div className="h-9 w-9 rounded-full bg-white/10" />
              </td>
              <td className="p-2">
                <div className="space-y-1">
                  <div className="h-4 w-20 rounded bg-white/10" />
                  <div className="h-3 w-16 rounded bg-white/10" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
