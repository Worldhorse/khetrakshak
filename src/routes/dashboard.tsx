import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONDITION_LABELS } from "@/lib/detect.functions";
import {
  BLOCKS,
  EXTRA_BLOCKS,
  RISK_LABELS,
  loadSubmissions,
  riskLevel,
  saveSubmissions,
  seedTrend,
  type RiskLevel,
  type Submission,
} from "@/lib/risk";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Block Outbreak Dashboard | KhetRakshak" },
      {
        name: "description",
        content:
          "Officer view of KhetRakshak: risk mix pie chart, block risk ranking, a confirm-or-correct verification queue and a 14-day regional risk trend.",
      },
      { property: "og:title", content: "Block Outbreak Dashboard | KhetRakshak" },
      {
        property: "og:description",
        content: "Live charts, verification queue and risk trend for agriculture officers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const LEVELS: RiskLevel[] = ["low", "moderate", "high", "critical"];

function Dashboard() {
  const [subs, setSubs] = useState<Submission[]>([]);

  useEffect(() => {
    const sync = () => setSubs(loadSubmissions());
    sync();
    window.addEventListener("khetrakshak-submissions", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("khetrakshak-submissions", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const cells = useMemo(() => {
    const latest = new Map<string, number>();
    for (const s of [...subs].reverse()) latest.set(s.blockId, s.score);
    const base = [...BLOCKS.map((b) => ({ id: b.id, risk: b.baseRisk })), ...EXTRA_BLOCKS];
    return base.map((c) => ({ ...c, risk: latest.get(c.id) ?? c.risk }));
  }, [subs]);

  const mix = useMemo(
    () =>
      LEVELS.map((l) => ({
        name: RISK_LABELS[l].en,
        value: cells.filter((c) => riskLevel(c.risk) === l).length,
        color: RISK_LABELS[l].color,
      })).filter((d) => d.value > 0),
    [cells],
  );

  const topBlocks = useMemo(
    () => [...cells].sort((a, b) => b.risk - a.risk).slice(0, 8),
    [cells],
  );

  const reviewed = subs.filter((s) => s.status !== "pending");
  const precision = reviewed.length
    ? Math.round((reviewed.filter((s) => s.status === "confirmed").length / reviewed.length) * 100)
    : null;
  const pending = subs.filter((s) => s.status === "pending");

  const avgRisk = Math.round(cells.reduce((s, c) => s + c.risk, 0) / cells.length);
  const gauge = [{ name: "risk", value: avgRisk, fill: RISK_LABELS[riskLevel(avgRisk)].color }];

  const trend = useMemo(() => {
    const base = seedTrend();
    if (subs.length) {
      base[base.length - 1] = Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length);
    }
    return base.map((v, i) => ({ day: `D${i - base.length + 1}`, risk: v }));
  }, [subs]);

  function review(id: string, status: "confirmed" | "corrected") {
    saveSubmissions(loadSubmissions().map((s) => (s.id === id ? { ...s, status } : s)));
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
        <div className="animate-fade-in">
          <h1 className="font-display text-3xl font-semibold">Block-level outbreak dashboard</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Every farmer check updates these charts — the regional risk mix, the worst-hit blocks, a
            confirm-or-correct queue, and the 14-day trend.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { v: "9.4 days", l: "Median detection lead time vs. visible symptoms" },
            { v: precision === null ? "—" : `${precision}%`, l: "Officer-confirmed accuracy this session" },
            { v: "~30%", l: "Estimated cut in blanket pesticide spraying" },
            { v: String(subs.length), l: "Farmer submissions received this session" },
          ].map((k, i) => (
            <Card
              key={k.l}
              className="animate-fade-in shadow-field transition-transform duration-200 hover:-translate-y-1"
              style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
            >
              <CardContent className="p-5">
                <p className="font-display text-2xl font-semibold">{k.v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-fade-in shadow-field">
            <CardHeader>
              <CardTitle>Risk mix across 20 blocks</CardTitle>
              <CardDescription>How many blocks sit at each risk level right now.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    animationDuration={900}
                  >
                    {mix.map((d) => (
                      <Cell key={d.name} fill={d.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: number) => [`${v} blocks`, ""]}
                  />
                  <Legend verticalAlign="bottom" height={28} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="animate-fade-in shadow-field">
            <CardHeader>
              <CardTitle>Regional risk gauge</CardTitle>
              <CardDescription>Average fused risk across all blocks.</CardDescription>
            </CardHeader>
            <CardContent className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={gauge}
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={210}
                  endAngle={-30}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" background cornerRadius={12} animationDuration={1100} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <p className="font-display text-4xl font-semibold">{avgRisk}</p>
                <p className="text-sm text-muted-foreground">{RISK_LABELS[riskLevel(avgRisk)].en}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in shadow-field">
            <CardHeader>
              <CardTitle>Worst-hit blocks</CardTitle>
              <CardDescription>Top eight blocks by current fused risk.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBlocks} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="id"
                    width={54}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="risk" radius={[0, 8, 8, 0]} animationDuration={900}>
                    {topBlocks.map((b) => (
                      <Cell key={b.id} fill={RISK_LABELS[riskLevel(b.risk)].color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="animate-fade-in shadow-field">
            <CardHeader>
              <CardTitle>14-day regional risk trend</CardTitle>
              <CardDescription>Today's point moves with each new submission.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: 0, right: 8 }}>
                  <defs>
                    <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#riskFill)"
                    animationDuration={1100}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="animate-fade-in shadow-field">
          <CardHeader>
            <CardTitle>Verification queue</CardTitle>
            <CardDescription>Confirm or correct what the model reported.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pending.length ? (
              pending.map((s) => (
                <div
                  key={s.id}
                  className="animate-fade-in rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {s.blockId} · {s.crop} — {s.disease}
                    </p>
                    <Badge variant="secondary">{s.score}/100</Badge>
                  </div>
                  <p className="text-muted-foreground">{CONDITION_LABELS[s.condition]}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="hover-scale" onClick={() => review(s.id, "confirmed")}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover-scale"
                      onClick={() => review(s.id, "corrected")}
                    >
                      Correct
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending submissions. Run a check on the farmer page.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
