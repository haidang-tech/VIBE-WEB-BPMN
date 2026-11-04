"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type BloodTypeDatum = {
  type: "A" | "B" | "AB" | "O";
  value: number;
  color: string;
};

export type CampaignVolumeDatum = {
  id: string;
  name: string;
  shortName: string;
  dateLabel: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  volume: number;
  donations: number;
};

type Props = {
  bloodTypeData: BloodTypeDatum[];
  campaignVolumeData: CampaignVolumeDatum[];
};

const pctFormatter = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 0,
});

export default function ReportsCharts({
  bloodTypeData,
  campaignVolumeData,
}: Props) {
  const totalBloodType = bloodTypeData.reduce((sum, item) => sum + item.value, 0);
  const totalVolume = campaignVolumeData.reduce(
    (sum, item) => sum + item.volume,
    0,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="text-primary size-4" aria-hidden />
            Phân bố nhóm máu
          </CardTitle>
          <CardDescription>
            Số ca hiến máu thành công theo nhóm máu A, B, AB, O.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalBloodType === 0 ? (
            <EmptyChart message="Chưa có ca hiến máu thành công nào để thống kê nhóm máu." />
          ) : (
            <>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bloodTypeData}
                      dataKey="value"
                      nameKey="type"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {bloodTypeData.map((item) => (
                        <Cell key={item.type} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value).toLocaleString("vi-VN")} ca`,
                        "Số ca",
                      ]}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        color: "var(--color-card-foreground)",
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {bloodTypeData.map((item) => (
                  <div
                    key={item.type}
                    className="bg-muted/30 border-border/70 flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      Nhóm {item.type}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.value} ca ·{" "}
                      {pctFormatter.format(
                        totalBloodType > 0 ? item.value / totalBloodType : 0,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="text-primary size-4" aria-hidden />
            Lượng máu thu được theo chiến dịch
          </CardTitle>
          <CardDescription>
            Tổng lượng máu (ml) của các ca hiến máu thành công, tổng{" "}
            {totalVolume.toLocaleString("vi-VN")} ml.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignVolumeData.length === 0 ? (
            <EmptyChart message="Chưa có chiến dịch nào để thống kê lượng máu." />
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={campaignVolumeData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="shortName"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(value) =>
                      Number(value).toLocaleString("vi-VN")
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString("vi-VN")} ml`,
                      "Lượng máu",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      color: "var(--color-card-foreground)",
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    dataKey="volume"
                    name="Lượng máu (ml)"
                    fill="var(--color-primary)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={64}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <BarChart3 className="size-7" aria-hidden />
      <p className="max-w-xs text-sm">{message}</p>
    </div>
  );
}
