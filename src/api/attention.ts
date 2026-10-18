import type { DashboardModel } from "./model";
import { DOWNTIME_LIMIT } from "./format";

/** Operational exceptions only: annual progress has no monthly pacing contract. */
export function attentionItems(models: DashboardModel[]) {
  return models
    .flatMap((model) => [
      ...model.gauges.flatMap((g, index) => {
        const downtime = g.mode === "downtime";
        const monthly =
          model.id === 5 || ((model.id === 8 || model.id === 9) && index === 0);
        if (
          !(downtime ? g.percent > DOWNTIME_LIMIT : monthly && g.percent < 85)
        )
          return [];
        return [
          {
            id: model.id,
            title: model.title,
            label: g.label,
            percent: g.percent,
            kind: downtime ? "downtime" : "plan",
          },
        ];
      }),
      ...model.bars.flatMap((bar) =>
        model.kind === "monthly" && bar.values[0] < 85
          ? [
              {
                id: model.id,
                title: model.title,
                label: bar.label,
                percent: bar.values[0],
                kind: "plan",
              },
            ]
          : [],
      ),
    ])
    .sort(
      (a, b) => Number(b.kind === "downtime") - Number(a.kind === "downtime"),
    );
}
