import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import {
  BarChart,
  LineChart,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Line,
  Cell,
} from "recharts";
import { Badge } from "@/src/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Users,
  DollarSign,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import type { GroupWithStats } from "../types/groups";

// 1) Our AnalyticsData type must now accept `futureCycles?: string[]`.

interface AnalyticsData {
  contributions: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  memberActivity: Array<{
    month: string;
    activeMembers: number;
    newMembers: number;
    leftMembers: number;
  }>;
  payoutDistribution: Array<{
    member: string;
    amount: number;
    percentage: number;
    payoutOrder?: number;
  }>;
  metrics: {
    totalMembers: number;
    memberGrowth: number;
    averageContribution: number;
    contributionGrowth: number;
    retentionRate: number;
    totalPaidOut: number;
    onTimePaymentRate: number;
    averagePayoutTime: number;
  };
  paymentStatus: {
    onTime: number;
    late: number;
    missed: number;
  };
  futureCycles?: string[];
}


interface GroupAnalyticsProps {
  group: GroupWithStats;
  analyticsData: AnalyticsData;
}

const COLORS = ["#EAB308", "#FCD34D", "#FDE68A", "#FEF3C7"];

// Basic currency formatter
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function GroupAnalytics({ group, analyticsData }: GroupAnalyticsProps) {
  const [activeSection, setActiveSection] =
    useState<"contributions" | "members" | "payouts">("contributions");

// Parse future cycles from group data
const futureCycles = group.futureCyclesJson 
  ? (JSON.parse(JSON.stringify(group.futureCyclesJson)) as string[])
  : [];

// Get members with payout orders (using the members array from GroupWithStats)
const membersWithPayouts = group.members
  .filter((m: { payoutOrder: number | null }) => typeof m.payoutOrder === 'number' && m.payoutOrder >= 0)
  .sort((a, b) => (a.payoutOrder || 0) - (b.payoutOrder || 0));

  
  return (
    <div className="space-y-8">
      {/* Key Metrics - Always visible */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <h2 className="text-2xl font-bold">
                  {analyticsData.metrics.totalMembers}
                </h2>
              </div>
              <Users className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              {analyticsData.metrics.memberGrowth > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
              <span
                className={
                  analyticsData.metrics.memberGrowth > 0 ? "text-green-500" : "text-red-500"
                }
              >
                {Math.abs(analyticsData.metrics.memberGrowth)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Contribution</p>
                <h2 className="text-2xl font-bold">
                  {formatter.format(analyticsData.metrics.averageContribution)}
                </h2>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Badge
                variant={
                  analyticsData.metrics.onTimePaymentRate >= 90
                    ? "default"
                    : "destructive"
                }
              >
                {analyticsData.metrics.onTimePaymentRate}% on-time payments
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Paid Out</p>
                <h2 className="text-2xl font-bold">
                  {formatter.format(analyticsData.metrics.totalPaidOut)}
                </h2>
              </div>
              <TrendingUp className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">
                Avg. {analyticsData.metrics.averagePayoutTime} days to payout
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Retention Rate</p>
                <h2 className="text-2xl font-bold">
                  {analyticsData.metrics.retentionRate}%
                </h2>
              </div>
              <CalendarDays className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Badge
                variant={
                  analyticsData.metrics.retentionRate >= 80
                    ? "default"
                    : "destructive"
                }
              >
                {analyticsData.metrics.retentionRate >= 80
                  ? "Healthy"
                  : "Needs Attention"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segmented Navigation */}
      <div className="border-b mb-8">
        <div className="flex flex-wrap -mb-px">
          <button
            onClick={() => setActiveSection("contributions")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "contributions"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Contributions
          </button>
          <button
            onClick={() => setActiveSection("members")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "members"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveSection("payouts")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "payouts"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Payouts
          </button>
        </div>
      </div>

      {/* Contributions Section */}
      {activeSection === "contributions" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contribution Trends</CardTitle>
              <CardDescription>
                Monthly contribution amounts over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.contributions}
                  margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString(undefined, { month: "short" })
                    }
                    tick={{ fill: "#666", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => formatter.format(value as number)}
                    tick={{ fill: "#666", fontSize: 12 }}
                    width={80}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `${value} payments`}
                    tick={{ fill: "#666", fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "amount") return formatter.format(value as number);
                      return `${value} payments`;
                    }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      padding: "8px",
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="amount" name="Amount" fill="#EAB308" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="count"
                    name="Number of Payments"
                    stroke="#FCD34D"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Status Distribution</CardTitle>
              <CardDescription>On-time vs late vs missed payments</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "On Time", value: analyticsData.paymentStatus.onTime },
                      { name: "Late", value: analyticsData.paymentStatus.late },
                      { name: "Missed", value: analyticsData.paymentStatus.missed },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#7C3AED"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[0, 1, 2].map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} payments`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members Section */}
      {activeSection === "members" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Member Activity</CardTitle>
              <CardDescription>Monthly member changes</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.memberActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="activeMembers"
                    name="Active Members"
                    stroke="#EAB308"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="newMembers"
                    name="New Members"
                    stroke="#FCD34D"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="leftMembers"
                    name="Left Members"
                    stroke="#FDE68A"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payout Distribution</CardTitle>
              <CardDescription>Member payout allocation</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={analyticsData.payoutDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    fill="#EAB308"
                    dataKey="amount"
                    nameKey="member"
                    labelLine={true}
                    label={({ name, percent, x, y }) => (
                      <text
                        x={x}
                        y={y}
                        fill="#000000"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fontWeight="500"
                      >
                        {`${name} (${(percent * 100).toFixed(0)}%)`}
                      </text>
                    )}
                  >
                    {analyticsData.payoutDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={["#EAB308", "#F59E0B", "#D97706", "#B45309"][index % 4]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatter.format(value as number)}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      padding: "8px",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{
                      paddingTop: "20px",
                    }}
                    formatter={(value) => (
                      <span style={{ color: "#000000", fontSize: "12px", fontWeight: "500" }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payouts Section */}
      {activeSection === "payouts" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 1) Payout History */}
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>Historical payout amounts by member</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.payoutDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="member"
                    tick={{ fill: "#666", fontSize: 12 }}
                    tickLine={{ stroke: "#666" }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatter.format(value as number)}
                    tick={{ fill: "#666", fontSize: 12 }}
                    tickLine={{ stroke: "#666" }}
                  />
                  <Tooltip
                    formatter={(value) => formatter.format(value as number)}
                    labelStyle={{ color: "#666" }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <Bar dataKey="amount" fill="#EAB308" radius={[4, 4, 0, 0]}>
                    {analyticsData.payoutDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 2) Scheduled Payouts Card */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Payouts</CardTitle>
              <CardDescription>Upcoming and recent payouts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.payoutDistribution.map((payout, index) => {
                  // If you track "payoutOrder" on each member, you can do:
                  // const nextDateIso = analyticsData.futureCycles?.[payoutOrder - 1];
                  // For demonstration, use the index:
                  const nextDateIso = analyticsData.futureCycles?.[index] ?? "";
                  let label = "N/A";
                  if (nextDateIso) {
                    const d = new Date(nextDateIso);
                    label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg bg-white/50 hover:bg-white/80 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{payout.member}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays className="h-4 w-4" />
                          <span>{`Next payout on ${label}`}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-500">
                          {formatter.format(payout.amount)}
                        </p>
                        <Badge variant="outline" className="mt-1 bg-yellow-50">
                          {payout.percentage}% of total
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {/* Summary Card */}
                <Card className="mt-6 border-yellow-100">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Scheduled Payouts
                        </p>
                        <h2 className="text-2xl font-bold text-yellow-500">
                          {formatter.format(
                            analyticsData.payoutDistribution.reduce((sum, item) => sum + item.amount, 0)
                          )}
                        </h2>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">
                          Next Payout Date
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {(() => {
                            const nextIso = analyticsData.futureCycles?.[0];
                            if (nextIso) {
                              const d = new Date(nextIso);
                              return d.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              });
                            }
                            return "N/A";
                          })()}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
