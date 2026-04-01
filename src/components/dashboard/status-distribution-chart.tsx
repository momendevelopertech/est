"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n";

const COLORS = ["#F5E642", "#1A1A1A", "#10B981", "#F59E0B", "#6B7280"];

type ChartDatum = {
  name: string;
  value: number;
};

type StatusDistributionChartProps = {
  title: string;
  subtitle: string;
  data: ChartDatum[];
  locale: Locale;
};

function formatNumber(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(value);
}

export function StatusDistributionChart({
  title,
  subtitle,
  data,
  locale
}: StatusDistributionChartProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="mt-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 0,
              right: 16,
              bottom: 0,
              left: 0
            }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--text-muted)",
                fontFamily: "var(--font-arabic)",
                fontSize: 12
              }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={110}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--text-secondary)",
                fontFamily: "var(--font-arabic)",
                fontSize: 12
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(245,230,66,0.08)" }}
              contentStyle={{
                borderRadius: "14px",
                border: "1px solid var(--border)",
                background: "var(--surface-elevated)",
                color: "var(--text-primary)",
                boxShadow: "var(--shadow-panel)"
              }}
              formatter={(value) => formatNumber(locale, Number(value ?? 0))}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
              {data.map((item, index) => (
                <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
