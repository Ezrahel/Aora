import { motion } from "motion/react";
import { Panel, SectionHead } from "./ui/primitives";

const QUOTES = [
  { quote: "We switched from hardcoded Stripe billing to AoraHQ in two days. The pricing engine alone saved us weeks of development.", role: "CTO", company: "B2B SaaS Company", tilt: -5 },
  { quote: "AoraHQ let us offer Paystack for our Nigerian customers and Stripe for our US customers from one dashboard. Our billing team stopped maintaining two codebases.", role: "Head of Engineering", company: "Pan-African SaaS", tilt: 0 },
  { quote: "The AI assistant is dangerously useful. I built a new enterprise tier in under a minute without touching code.", role: "Founder", company: "Developer Tools Startup", tilt: 5 },
];

export default function Testimonials() {
  return (
    <section data-scene="compare" className="lp-section lp-rule overflow-hidden">
      <div className="lp-wrap">
        <SectionHead index="09" label="Trusted by builders" align="center" title="What teams are saying." />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-3" style={{ perspective: 1600 }}>
          {QUOTES.map((item, i) => (
            <motion.figure
              key={item.role}
              initial={{ opacity: 0, y: 50, rotateY: item.tilt * 3 }}
              whileInView={{ opacity: 1, y: i === 1 ? -14 : 0, rotateY: item.tilt }}
              whileHover={{ rotateY: 0, y: -18, transition: { duration: 0.25 } }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <Panel className="lp-panel-solid h-full p-6 flex flex-col justify-between gap-8">
                <blockquote className="text-[17px] leading-snug tracking-[-0.01em] lp-text">{item.quote}</blockquote>
                <figcaption className="lp-data">
                  <span className="lp-text">{item.role}</span> <span className="lp-muted">{item.company}</span>
                </figcaption>
              </Panel>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
