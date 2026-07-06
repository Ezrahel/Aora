# AoraHQ Waitlist — Launch Plan

## 1. The Waitlist Page

### URL
`/waitlist` — linked from the hero CTA ("Connect Your Gateway" becomes "Join the Waitlist" until we launch), the bottom CTA, and a fixed "Notify Me" badge in the navbar.

### Above the Fold
| Element | Copy / Direction |
|---|---|
| **Headline** | "Billing infrastructure that bends to your business model is almost here." |
| **Subhead** | "We're in private beta with 12 SaaS teams. Join the waitlist and get early access, a dedicated onboarding call, and 3 months free on any plan." |
| **Email input** | Prominent centered input + "Get Early Access" button. Email validation + Mailchimp / Resend API call. |
| **Social proof** | "Join 340+ founders and engineering leaders" counter (animated count-up) |
| **Trust line** | "No spam. No sales calls. We'll ping you when your spot opens — usually within 48 hours." |

### Below the Fold

**"What you get"** — 3-column card grid:
- **Early access** — Be among the first to integrate AoraHQ. Shape the roadmap with direct feedback to the founding team.
- **Concierge onboarding** — A 30-min call with an engineer to map your billing model, connect your gateway, and ingest your first events.
- **Founder's plan** — 3 months free on any tier, locked in for life. No expiration on your discounted rate.

**"Who's behind this"** — Brief founder section. Photo, 1-paragraph bio, Twitter/LinkedIn links. Real names build trust.

**FAQ accordion:**
- When will I get access? *We onboard in batches. Most teams get access within 48 hours of joining.*
- What gateways do you support? *Stripe, Paystack, and Flutterwave are live. Monnify and SeerBit are in development.*
- Do I need to migrate my existing subscriptions? *No. You keep your current billing running while you configure AoraHQ. When you're ready, flip the switch.*
- What does it cost after the founder's plan? *Pricing starts at ₦0 for the first ₦1M in MRR processed. Transparent, usage-based pricing after that.*
- Is my data safe? *AES-256-GCM encryption at rest. Your API keys never touch disk in plaintext. SOC 2 audit in progress.*

### Design

Same palette as the landing page (light-mode default, dark toggle). The waitlist page should feel like a natural extension of the landing page — same Navbar/Footer, same glass-card aesthetic, same typography.

The email input should be hard to miss: full-width on mobile, centered card on desktop, with a subtle pulse glow on the submit button.

---

## 2. Technical Implementation

### Stack
- **Component**: `src/components/landing/Waitlist.tsx` — self-contained section
- **Route**: `/waitlist` → `waitlist` tab in `src/routes.ts`
- **Storage**: For MVP, write to a JSON file via a tiny Express endpoint at `POST /api/waitlist`. Later migrate to the DB.
- **Email capture**: Use [Resend](https://resend.com) for email confirmation + notification to the founding team.

### API Endpoint (`POST /api/waitlist`)

```json
// Request
{
  "email": "founder@example.com",
  "name": "Jane Founder",
  "company": "Acme SaaS",
  "gateway": "stripe",
  "mrr": "10k-50k",
  "referral": "twitter"
}

// Response 201
{ "status": "ok", "position": 341 }
```

### Fields
| Field | Required | Type | Notes |
|---|---|---|---|
| `email` | yes | email | Validated client + server side |
| `name` | no | string | Optional but encouraged |
| `company` | no | string | Helps qualify leads |
| `gateway` | no | enum | stripe / paystack / flutterwave / other |
| `mrr` | no | enum | pre-revenue / <10k / 10k-50k / 50k-200k / 200k+ |
| `referral` | no | string | How they heard about us |

### UX Flow
1. User enters email → clicks "Get Early Access"
2. Button shows loading spinner → validates → shows success state
3. Fade-in secondary form appears: "Great, tell us more!" with name, company, gateway dropdown
4. Submit → thank-you message with queue position + referral link
5. Optional: trigger a welcome email via Resend

### Referral System (Optional v2)

Give each signup a referral link (`/waitlist?ref=abc123`). Showing "You moved up N spots by referring friends" creates viral loops. Can be faked early on ("You moved up 12 spots!") and made real when the waitlist hits 500+.

---

## 3. Pre-Launch Campaign (4-6 weeks before opening)

### Week 1 — The Tease
- Post the landing page on **Product Hunt** as "Coming Soon" with a waitlist signup
- Tweet/X thread: "We built a billing engine that handles Stripe + Paystack + Flutterwave from one dashboard. Here's why that matters for African SaaS." with a waitlist link
- Share in **Nigerian SaaS WhatsApp/Discord groups**, **Twitter (#BuildInPublic)**

### Week 2 — Stories That Stick
- Blog post: "The Billing Stack That Scales With You: A Technical Deep Dive" (published on the landing page `/blog`)
- LinkedIn post by founding team: "Why I stopped hardcoding billing logic" — personal story resonates
- Cold DM 20-30 technical founders who've tweeted about Stripe billing pain

### Week 3 — Community Planting
- Comment on relevant threads (Stripe docs issues, Paystack community, Indie Hackers)
- Offer to hop on 15-min calls with anyone evaluating billing infrastructure — record the calls (with permission) for content
- Cross-post on **r/SaaS**, **r/startups**, **HackerNews "Show HN"** (when ready)

### Week 4 — The Build-Up
- Share waitlist milestone: "340 founders joined in 3 weeks. Here's what they told us they need."
- Post a short teaser video / GIF of the pricing engine widget working
- Direct outreach to 2-3 well-known African SaaS founders for endorsements

---

## 4. Launch Day

### The Post
- "Show HN: AoraHQ — Open-source billing orchestration engine (Stripe, Paystack, Flutterwave)"
- Product Hunt launch with a maker video (2 min max — show the pricing engine live)
- Tweet storm: feature breakdown → pain → solution → waitlist link
- Email everyone on the waitlist: "Your spot is opening. Confirm your interest within 72 hours or we move to the next person."

### Launch Week Channels
| Channel | Tactics |
|---|---|
| **HN / PH** | Main launch threads, respond to every comment within 15 minutes |
| **Twitter / X** | Every 4 hours — different angle (tech, founder story, problem, feature highlight) |
| **LinkedIn** | Long-form post about the journey + product philosophy |
| **Indie Hackers** | "How I built a billing engine for African SaaS in 6 weeks" |
| **Slack / Discord communities** | Share in SaaS-specific channels (not spam — genuine "we built this for X" context) |
| **Direct email** | Waitlist confirmation phase — urge people to convert |

---

## 5. Post-Launch: Keeping Momentum

### First 30 Days
- **Day 1**: Onboard the first 5 customers manually (concierge onboarding). Record everything that surprises them.
- **Day 7**: Ship 3 fast-fix improvements based on the first batch's feedback. Post a public changelog.
- **Day 14**: Case study #1 — write up one customer's migration story with real numbers.
- **Day 21**: Release a feature one customer specifically asked for. Tag them when you ship it.
- **Day 30**: "We processed ₦X in our first month" retrospective — raw numbers, lessons, roadmap.

### Metrics to Track
| Metric | Target (Month 1) |
|---|---|
| Waitlist signups | 1,000+ |
| Waitlist → activation | 30%+ |
| Time-to-first-event (TTFE) | < 2 hours |
| NPS after onboarding | 40+ |
| Gateway connections made | 50+ |
| Usage events ingested | 1M+ (across all customers) |

### Content Engine
- **Weekly**: One technical blog post (pricing engine internals, gateway adapter pattern, CockroachDB serialization)
- **Bi-weekly**: One customer story or interview
- **Monthly**: Public roadmap update — what shipped, what's next, what we learned
- **Always**: Reply to every single tweet/DM/comment within 24 hours. The early community is everything.

---

## 6. Files to Create

| File | Purpose |
|---|---|
| `src/components/landing/Waitlist.tsx` | Waitlist page component |
| `src/components/landing/WaitlistSection.tsx` | Embeddable waitlist section for the landing page bottom (optional) |
| `src/api/routes/waitlist.ts` | Express handler for `POST /api/waitlist` |
| `src/api/db/repositories/waitlist.repo.ts` | DB layer for waitlist entries (optional, can use flat file first) |
| `.env` addition: `RESEND_API_KEY` | For email confirmations and team notifications |

---

## 7. Copy for the Welcome Email (Send via Resend)

**Subject:** You're on the AoraHQ waitlist. Here's what happens next.

**Body:**

> Hey {{name}},
>
> You're #{{position}} on the AoraHQ waitlist. Welcome.
>
> Here's what's happening behind the scenes:
>
> - **We're onboarding in batches of 5** — every few days. We want every early customer to have a direct line to the founding team.
> - **When your batch opens**, you'll get a Calendly link to book a 30-min onboarding call. We'll map your pricing model, connect your gateway, and show you around.
> - **You're locked into the Founder's Plan**: 3 months free on any tier. No expiration. This stays with you.
>
> While you wait, here's how you can move up the list:
> [Referral link — {{referral_url}}]
>
> Questions? Reply to this email. I read every one.
>
> — Ditech, Founder @ AoraHQ

---

## 8. Simple Waitlist Storage (Pre-DB)

Until CockroachDB is running, store waitlist entries as a JSON line-delimited file:

`data/waitlist.jsonl`

Each line is a JSON object. Read the file to count positions, append to add entries. Works immediately, zero dependencies, easy to migrate to a real DB later.

```typescript
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const WAITLIST_FILE = join(DATA_DIR, "waitlist.jsonl");

export async function addWaitlistEntry(entry: Record<string, unknown>): Promise<number> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(WAITLIST_FILE, JSON.stringify({ ...entry, createdAt: new Date().toISOString() }) + "\n");
  return await countWaitlist();
}

export async function countWaitlist(): Promise<number> {
  try {
    const content = await readFile(WAITLIST_FILE, "utf-8");
    return content.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
```
