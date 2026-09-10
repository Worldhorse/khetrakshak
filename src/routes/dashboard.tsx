import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
          "Officer view of KhetRakshak: block-level crop disease hotspots, a confirm-or-correct verification queue and a 14-day regional risk trend.",
      },
      { property: "og:title", content: "Block Outbreak Dashboard | KhetRakshak" },
      {
        property: "og:description",
        content: "Live hotspots, verification queue and risk trend for agriculture officers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function riskColor(score: number) {
  return RISK_LABELS[riskLevel(score)].className;
}

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
    const base = [
      ...BLOCKS.map((b) => ({ id: b.id, risk: b.baseRisk })),
      ...EXTRA_BLOCKS,
    ];
    return base.map((c) => ({ ...c, risk: latest.get(c.id) ?? c.risk }));
  }, [subs]);

  const reviewed = subs.filter((s) => s.status !== "pending");
  const precision = reviewed.length
    ? Math.round((reviewed.filter((s) => s.status === "confirmed").length / reviewed.length) * 100)
    : null;
  const pending = subs.filter((s) => s.status === "pending");

  const trend = useMemo(() => {
    const base = seedTrend();
    if (subs.length) {
      base[base.length - 1] = Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length);
    }
    return base;
  }, [subs]);

  function review(id: string, status: "confirmed" | "corrected") {
    saveSubmissions(loadSubmissions().map((s) => (s.id === id ? { ...s, status } : s)));
  }

  const points = trend
    .map((v, i) => `${(i / (trend.length - 1)) * 300 + 10},${110 - (v / 100) * 100}`)
    .join(" ");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Block-level outbreak dashboard</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Every farmer check updates this view — hotspots by block, a confirm-or-correct queue instead
            of blind field visits, and the regional risk trend.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { v: "9.4 days", l: "Median detection lead time vs. visible symptoms" },
            { v: precision === null ? "—" : `${precision}%`, l: "Officer-confirmed accuracy this session" },
            { v: "~30%", l: "Estimated cut in blanket pesticide spraying" },
            { v: String(subs.length), l: "Farmer submissions received this session" },
          ].map((k) => (
            <Card key={k.l} className="shadow-field">
              <CardContent className="p-5">
                <p className="font-display text-2xl font-semibold">{k.v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-field">
            <CardHeader>
              <CardTitle>Hotspot map — 20 blocks</CardTitle>
              <CardDescription>Colour shows current fused risk out of 100.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {cells.map((c) => (
                <div
                  key={c.id}
                  title={`${c.id}: ${c.risk}/100`}
                  className={`grid aspect-square place-content-center rounded-lg text-sm font-semibold text-white ${riskColor(c.risk)}`}
                >
                  <span className="text-center">{c.risk}</span>
                  <span className="text-center text-[10px] font-normal opacity-90">{c.id}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid content-start gap-6">
            <Card className="shadow-field">
              <CardHeader>
                <CardTitle>Verification queue</CardTitle>
                <CardDescription>Confirm or correct what the model reported.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {pending.length ? (
                  pending.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {s.blockId} · {s.crop} — {s.disease}
                        </p>
                        <Badge variant="secondary">{s.score}/100</Badge>
                      </div>
                      <p className="text-muted-foreground">{CONDITION_LABELS[s.condition]}</p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => review(s.id, "confirmed")}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => review(s.id, "corrected")}>
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

            <Card className="shadow-field">
              <CardHeader>
                <CardTitle>14-day regional risk trend</CardTitle>
              </CardHeader>
              <CardContent>
                <svg viewBox="0 0 320 120" width="100%" height="120" role="img" aria-label="Risk trend">
                  <polyline
                    points={points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                  />
                  <line
                    x1="310"
                    y1="10"
                    x2="310"
                    y2="110"
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    className="text-muted-foreground"
                  />
                </svg>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dashed marker = today, updated by new submissions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
