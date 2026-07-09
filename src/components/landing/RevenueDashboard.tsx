import { motion } from "motion/react";
import { ChevronRight, Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const chartData = [
  { month: "Jan", mrr: 1540000, usage: 102000 },
  { month: "Feb", mrr: 1820000, usage: 154000 },
  { month: "Mar", mrr: 2100000, usage: 198000 },
  { month: "Apr", mrr: 2450000, usage: 220000 },
  { month: "May", mrr: 2900000, usage: 310000 },
  { month: "Jun", mrr: 3600000, usage: 420000 },
];

export default function RevenueDashboard() {
  return (
    <section className="py-32 relative overflow-hidden lp-bg">
      <div className="absolute inset-0 bg-gradient-to-b pointer-events-none" style={{ backgroundImage: "linear-gradient(to bottom, var(--lp-bg), var(--lp-grad-stop), var(--lp-bg))" }} />
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div className="lg:col-span-4 space-y-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Revenue Analytics</span>
            <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">Real-time financial intelligence</h2>
            <p className="text-sm lp-secondary font-medium leading-relaxed">MRR, ARR, churn, trial conversion, plan performance — computed from your actual payment data, automatically reconciled between your gateway and our metering engine.</p>
            <div className="pt-2">
              <button className="text-[11px] font-bold lp-text border lp-border-glass hover:lp-surface lp-card px-4 py-2.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5">
                Explore Revenue Analytics <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
          <motion.div className="lg:col-span-8" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lp-glass border lp-border-glass rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b lp-divider pb-4">
                <div>
                  <div className="text-xs font-bold lp-text">Consolidated Cash-Flow Intelligence</div>
                  <div className="text-[10px] lp-secondary mt-0.5">Usage + subscription revenue across all gateways</div>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase">System Online</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="lp-card rounded-2xl p-4">
                  <div className="text-[9px] lp-secondary font-bold uppercase tracking-widest">MRR</div>
                  <div className="text-xl font-bold font-mono lp-text mt-1">₦3,600,000</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">+18.5% this month</div>
                </div>
                <div className="lp-card rounded-2xl p-4">
                  <div className="text-[9px] lp-secondary font-bold uppercase tracking-widest">ARR</div>
                  <div className="text-xl font-bold font-mono lp-text mt-1">₦43,200,000</div>
                  <div className="text-[10px] lp-secondary mt-1">Annualized projection</div>
                </div>
                <div className="lp-card rounded-2xl p-4">
                  <div className="text-[9px] font-bold lp-secondary uppercase tracking-widest">Events (30d)</div>
                  <div className="text-xl font-bold font-mono lp-text mt-1">2,410,250</div>
                  <div className="text-[10px] lp-secondary mt-1 flex items-center gap-1"><Activity className="h-3 w-3 lp-muted" />API, leads, seats</div>
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="revMrr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lp-accent)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--lp-accent)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--lp-chart-grid)" />
                    <XAxis dataKey="month" stroke="var(--lp-chart-axis)" fontSize={9} tickLine={false} />
                    <YAxis stroke="var(--lp-chart-axis)" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--lp-tooltip-bg)", border: "1px solid var(--lp-tooltip-border)", borderRadius: "8px", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="mrr" stroke="var(--lp-accent)" strokeWidth={2} fillOpacity={1} fill="url(#revMrr)" name="MRR (NGN)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="text-[9px] font-bold lp-secondary uppercase tracking-widest">Top Accounts</div>
                <div className="lp-card rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead>
                      <tr className="border-b lp-divider lp-secondary text-[9px]">
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider">Customer</th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider">Plan</th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider">Usage</th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Acme Workspace Corp", plan: "Growth Enterprise", usage: "12,500 leads", amount: "₦45,000" },
                        { name: "Linear Technologies Ltd", plan: "Enterprise SLA", usage: "85,200 leads", amount: "₦120,500" },
                        { name: "Stellar Design Inc", plan: "Basic Starter", usage: "1,200 leads", amount: "₦15,000" },
                      ].map((row) => (
                        <tr key={row.name} className="border-b lp-divider last:border-0 hover:lp-surface">
                          <td className="py-2.5 px-4 lp-text font-medium">{row.name}</td>
                          <td className="py-2.5 px-4 lp-accent">{row.plan}</td>
                          <td className="py-2.5 px-4 lp-secondary">{row.usage}</td>
                          <td className="py-2.5 px-4 text-right lp-text font-bold">{row.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}