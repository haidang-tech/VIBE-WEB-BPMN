"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Clock3,
  Droplets,
  Layers,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type StatusDatum = {
  status: string;
  label: string;
  value: number;
  color: string;
};

export type BloodTypeDatum = {
  type: "A" | "B" | "AB" | "O";
  count: number;
  volume: number;
  color: string;
};

export type SlotDatum = {
  slot: string;
  value: number;
};

export type CampaignVolumeDatum = {
  id: string;
  name: string;
  shortName: string;
  dateLabel: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  volume: number;
  donations: number;
  selected: boolean;
};

type Props = {
  statusData: StatusDatum[];
  bloodTypeData: BloodTypeDatum[];
  slotData: SlotDatum[];
  campaignVolumeData: CampaignVolumeDatum[];
  totalRegistrations: number;
};

export default function ReportsCharts({
  statusData,
  bloodTypeData,
  slotData,
  campaignVolumeData,
  totalRegistrations,
}: Props) {
  const totalBloodType = bloodTypeData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Hồ sơ theo trạng thái"
          icon={<Layers className="text-primary size-4" aria-hidden />}
        >
          {totalRegistrations === 0 ? (
            <EmptyChart message="Chưa có hồ sơ nào trong phạm vi đã chọn." />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusData}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={126}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString("vi-VN")} hồ sơ`,
                      "Số lượng",
                    ]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="value" name="Hồ sơ" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {statusData.map((item) => (
                      <Cell key={item.status} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Phân bố nhóm máu"
          icon={<PieChartIcon className="text-primary size-4" aria-hidden />}
        >
          {totalBloodType === 0 ? (
            <EmptyChart message="Chưa có ca hiến máu thành công để thống kê nhóm máu." />
          ) : (
            <>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bloodTypeData}
                      dataKey="count"
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
                      contentStyle={tooltipStyle}
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
                      {item.count} ca ·{" "}
                      {Math.round(
                        totalBloodType > 0
                          ? (item.count / totalBloodType) * 100
                          : 0,
                      )}
                      %
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Lượng máu theo nhóm máu"
          icon={<Droplets className="text-primary size-4" aria-hidden />}
        >
          {totalBloodType === 0 ? (
            <EmptyChart message="Chưa có dữ liệu lượng máu theo nhóm máu." />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bloodTypeData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="type"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
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
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="volume" name="Lượng máu" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {bloodTypeData.map((item) => (
                      <Cell key={item.type} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Hồ sơ theo khung giờ"
          icon={<Clock3 className="text-primary size-4" aria-hidden />}
        >
          {totalRegistrations === 0 ? (
            <EmptyChart message="Chưa có hồ sơ để thống kê theo khung giờ." />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={slotData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="slot"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={56}
                    angle={-20}
                    textAnchor="end"
                    tick={{
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString("vi-VN")} hồ sơ`,
                      "Số lượng",
                    ]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="value"
                    name="Hồ sơ"
                    fill="var(--color-primary)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Lượng máu thu được theo chiến dịch"
        icon={<BarChart3 className="text-primary size-4" aria-hidden />}
      >
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
                  tick={{
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
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
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="volume"
                  name="Lượng máu (ml)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={64}
                >
                  {campaignVolumeData.map((item) => (
                    <Cell
                      key={item.id}
                      fill="var(--color-primary)"
                      fillOpacity={
                        campaignVolumeData.some((campaign) => campaign.selected) &&
                        !item.selected
                          ? 0.32
                          : 1
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-card-foreground)",
  fontSize: 13,
};

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <BarChart3 className="size-7" aria-hidden />
      <p className="max-w-xs text-sm">{message}</p>
    </div>
  );
}
