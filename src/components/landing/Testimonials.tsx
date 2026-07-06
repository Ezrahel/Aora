import { motion } from "motion/react";

const testimonials = [
  { quote: "We switched from hardcoded Stripe billing to AoraHQ in two days. The pricing engine alone saved us weeks of development.", role: "CTO", company: "B2B SaaS Company" },
  { quote: "AoraHQ let us offer Paystack for our Nigerian customers and Stripe for our US customers from one dashboard. Our billing team stopped maintaining two codebases.", role: "Head of Engineering", company: "Pan-African SaaS" },
  { quote: "The AI assistant is dangerously useful. I built a new enterprise tier in under a minute without touching code.", role: "Founder", company: "Developer Tools Startup" },
];

export default function Testimonials() {
  return (
    <section className="py-24 relative lp-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <span className="text-[10px] font-bold lp-secondary uppercase tracking-widest block">Trusted by builders</span>
          <h2 className="text-3xl sm:text-4xl font-black lp-text tracking-tight">What teams are saying</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} className="lp-glass border lp-border-glass rounded-2xl p-6 space-y-4">
              <svg className="h-5 w-5 lp-muted" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
              <p className="text-sm lp-secondary font-medium leading-relaxed">{t.quote}</p>
              <div><div className="text-xs font-bold lp-text">{t.role}</div><div className="text-[10px] lp-muted">{t.company}</div></div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}