# Answer key: 20 benchmark questions (as of 10 October 2026)

Built only with Composio tools (COMPOSIO_SEARCH_FETCH_URL_CONTENT, COMPOSIO_SEARCH_TAVILY, COMPOSIO_SEARCH_WEB, EXA_SEARCH). "Verified" = read on the official or primary page during this run. "Unverified" = from search snippets, secondary sources or general knowledge. Note: many page reads came from Exa's cache (`source: cached`), not a live crawl, so very recent edits could be missed.

## Corrections to the brief's grading guide

| Q | Brief says | Correct / refined |
|---|---|---|
| 1 | Correct in substance | Add: confirmed by GOV.UK policy paper published 17 Sept 2026, with anti-circumvention rules (no transfers from stocks and shares/IF ISAs into cash ISAs, 22% charge on interest on cash held in non-cash ISAs). The GOV.UK ISA overview page still only says "£20,000 in 2026 to 2027", so it is not the best source for the 2027 change. |
| 3 | "Dettol 24h protection disinfectant spray" | The product is **Dettol Protect 24 (protect24) Antibacterial Cleaning Spray / Multi Surface Cleaner** (pump trigger, not aerosol). Active ingredients are **benzalkonium chloride 0.25 g and didecyldimonium chloride 0.25 g per 100 g** (quaternary ammonium compounds). It is not chloroxylenol (Dettol Original liquid) or ethanol (Dettol Disinfectant Spray aerosol); results quoting those are wrong. |
| 4 | "? $5 per 1k searches historically; may have changed" | **Now $7 per 1,000 `/search` requests** (up to 10 results; +$1/1k for each result over 10). $5/1k now applies to `/answer`, not search. Deep search is $12 to $15/1k. Confirmed by billing too: each EXA_SEARCH call in this run returned `costDollars.total = 0.007`. |
| 5 | Project > Settings > Environment Variables | Current docs say: select project, then **Environment Variables in the sidebar**; enter Name and Value, choose environments, Save, then **redeploy** (changes do not apply to existing deployments). Close enough; "Settings" wording is slightly outdated. |
| 8 | Class 2/3, gaps usually up to 6 years | Correct: GOV.UK says you can only pay for the past 6 years, deadline 5 April each year (e.g. 2025 to 2026 gaps until 5 April 2032). |
| 10 | "? it does" | Partly outdated premise. YNAB's own July 2026 help page says Direct Import uses **MX and Plaid** (TrueLayer, the 2021 UK/EU partner, is no longer listed), and YNAB's site says it is an agent of Plaid Financial Ltd (FCA) for UK account information. No official YNAB page lists Starling by name; a June 2026 third-party review says Starling is among 80+ supported UK banks. Treat "yes, via Plaid Open Banking, check in-app institution search" as the best answer, but **unverified on an official page**. |
| 11 | "pause after 7 days inactivity" | Refine: Supabase pauses Free Plan projects that show **low activity over a 7-day period** (too few user database requests, not zero). Warning email about a week before. Prevent by upgrading to Pro (paid projects are never paused) or generating regular API/database activity. Paused projects can be restored for up to **1 year**. |
| 12 | Docs at /claude-code-on-the-web | The access levels and the default allowed-domain list now live on **code.claude.com/docs/en/cloud-environments** ("Configure cloud environments"). The /claude-code-on-the-web page only links there. Four levels: **None, Trusted (default), Full, Custom**. |
| 13 | Materials page | Fine. Also good: developer.apple.com/documentation/technologyoverviews/liquid-glass (overview, links "Adopting Liquid Glass"). Materials page added Liquid Glass guidance 9 June 2025, updated 9 Sept 2025. |
| 20 | Claude Code on the web docs | Best page is the same cloud-environments page (network levels, allowlist, GitHub proxy 403 messages such as "GitHub access to ... is not enabled for this session"). |

## Answers

### 1. cash ISA allowance 2027 changes
From **6 April 2027** the annual cash ISA limit falls to **£12,000 for under-65s**; people **aged 65 or over keep £20,000**; the overall ISA allowance stays **£20,000** (announced at Budget 2025, Nov 2025). A GOV.UK policy paper (17 Sept 2026) adds anti-circumvention rules: limits on transfers from non-cash ISAs into cash ISAs, a flat 22% charge on interest paid on cash held in stocks and shares/IF ISAs, and rules on money market funds. **Verified.**
- https://www.gov.uk/government/publications/reduction-in-the-cash-individual-savings-account-isa-limit/cash-individual-savings-account-isa-limit-reduction
- (GOV.UK overview https://www.gov.uk/individual-savings-accounts only confirms £20,000 for 2026 to 2027.)

### 2. 0.2m right angle data usb-c cable
No single answer: good results are UK product listings for a 20 cm (0.2 m) USB-C to USB-C (or USB-A to USB-C) cable with a 90° connector that states data transfer (USB 2.0 480 Mbps or USB 3.x 5 to 10 Gbps), not "charge only". Amazon UK, specialist shops (e.g. Cable Matters, StarTech, UGREEN) are acceptable. **Unverified** (not checked; listings change).

### 3. Dettol 24h protect spray ingredients
The product is **Dettol Protect 24 Antibacterial Cleaning Spray** (also sold as "protect24 Multi Surface Cleaner", 460 ml pump, Reckitt). Label: per 100 g contains **0.25 g benzalkonium chloride and 0.25 g didecyldimonium chloride**; also water, polymer, disodium EDTA, citric acid, tristyrylphenol ethoxylates, decylamine oxide, lauramine oxide, fragrance; preservatives methylisothiazolinone, benzisothiazolinone, iodopropynyl butylcarbamate. Claims to keep killing 99.9% of bacteria and enveloped viruses for up to 24 hours. **Verified on retailer listing (Morrisons), not on dettol.co.uk** (Dettol's own category pages did not show it).
- https://groceries.morrisons.com/products/dettol-protect-24-hour-antibacterial-cleaning-spray/112886109

### 4. Exa search API price per 1000 searches
**$7 per 1,000 `/search` requests** (covers up to 10 results; each extra result $1/1k; AI page summaries $1/1k pages). Deep search $12/1k (deep-lite, deep) or $15/1k (deep-reasoning); `/answer` $5/1k; `/contents` $1/1k pages. New accounts get $20 free credit and the free tier adds $10 a month. **Verified** (pricing page, plus `costDollars` 0.007 per call observed).
- https://exa.ai/pricing (redirects to Exa docs pricing page)

### 5. how to add environment variable in Vercel dashboard without command line
In the Vercel dashboard, select the project (or Team Settings for shared, team-wide variables), open **Environment Variables** in the sidebar, enter the Name and Value, choose which environments (Production, Preview, Development, custom) it applies to, click **Save**, then **redeploy**, because changes only apply to new deployments. **Verified.**
- https://vercel.com/docs/environment-variables/managing-environment-variables

### 6. set up custom email domain with iCloud+ step by step
Needs iCloud+, two-factor authentication and a primary iCloud Mail address. On iCloud.com go to icloud.com/icloudplus > **Custom Email Domain** > "Add a domain you own" (or buy a new domain), choose Only You or You and Other People, add existing addresses (each gets a verification email), then **update DNS records at your registrar** (automatically by signing in, or manually: MX, SPF TXT, DKIM CNAME, domain-verification TXT), then "Finish setup" and pick a default address. Up to 5 domains, 3 addresses per person per domain. Can also be done on iPhone: Settings > [name] > iCloud > Mail > Custom Email Domain. **Verified** (steps); exact DNS record values are on the linked "Set up an existing domain" article (**unverified** here).
- https://support.apple.com/guide/icloud/add-a-domain-you-own-mma473945269/icloud
- https://support.apple.com/guide/icloud/set-up-a-custom-email-domain-mm0e4339d289/icloud
- https://support.apple.com/guide/iphone/set-up-a-custom-email-domain-iph4de56a8a2/ios

### 7. How does Woolite Darks work
Woolite Darks is a gentle liquid detergent for cold, delicate washes; the maker says its formula gives "fade protection", plus protection from pilling and stretching, by cleaning gently in cold water (less dye loss and fibre damage than hot, harsh washes). Independent tests suggest much of the benefit comes from washing cold. **Verified on the official US page (woolite.us)**; no UK Woolite page found; mechanism claims are the maker's own.
- https://www.woolite.us/woolitereg-products/woolite-darks-defense-100-fl-oz

### 8. how to check National Insurance record and pay voluntary contributions
Check your record online on GOV.UK (sign in with Government Gateway / GOV.UK One Login, or the HMRC app); it shows gaps, whether paying would help your State Pension forecast, the cost, and whether you can pay online. You can then pay voluntary **Class 2 or Class 3** contributions (online for many people, otherwise via HMRC); you can only pay for the **past 6 years**, with a 5 April deadline each year (e.g. 2025 to 2026 gaps until 5 April 2032). Check NI credits first; people abroad have separate rules. **Verified.**
- https://www.gov.uk/check-national-insurance-record
- https://www.gov.uk/voluntary-national-insurance-contributions
- https://www.gov.uk/voluntary-national-insurance-contributions/deadlines

### 9. iPhone shortcut transcribe voice memo to text automatically
Since iOS 18, Voice Memos transcribes recordings itself: open the recording and tap the Transcription button to view or copy the text (Notes audio recordings also transcribe). For automation, the Shortcuts app has a **Transcribe Audio** action (iOS 18+) that can be chained with "Save to Notes"/Files and run from the share sheet or a personal automation. **Verified** for Voice Memos/Notes transcripts (Apple Support); Shortcuts action **unverified** here.
- https://support.apple.com/guide/iphone/make-a-recording-iph4d2a39a3b/ios
- https://support.apple.com/guide/iphone/record-and-transcribe-audio-iphbe11247b5/ios

### 10. does YNAB support Starling Bank direct import 2026
Probably yes, but not confirmed on an official page. YNAB's Direct Import now works through **MX and Plaid** (help page dated 2 July 2026; TrueLayer, its 2021 UK/EU partner, is no longer named), and YNAB is registered as an agent of Plaid Financial Ltd for UK Open Banking. A June 2026 review says Starling is among 80+ supported UK banks; third-party tools (BudgetSyncer, Sync for YNAB) also sync Starling, and CSV/file import always works. Answer: check YNAB's in-app institution search. **Partly verified** (provider facts verified; Starling support unverified).
- https://support.ynab.com/en_us/how-direct-import-works-H1IGYLgnxl
- https://www.ynab.com/whats-new/direct-import-in-the-uk-and-eu (2021, TrueLayer, now outdated)
- https://www.thefinancialwilderness.com/ynab-budgeting-app-review/ (secondary)

### 11. Supabase free project paused after inactivity how to prevent
Supabase pauses Free Plan projects that show **low activity over a 7-day period** (too few user database requests; "a few user requests to the database each day" usually prevents it), after a warning email about a week ahead. To prevent it, **upgrade to Pro** (paid projects are never paused) or keep it active (open the dashboard, make API calls, e.g. a scheduled ping). Paused projects can be resumed from the dashboard for up to **1 year**. **Verified.**
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/pricing ("Free projects are paused after 1 week of inactivity. Limit of 2 active projects.")

### 12. Claude Code cloud environment network access allowed domains
Each cloud environment has one of four network access levels: **None** (no outbound access), **Trusted** (default: allowlisted domains only, such as package registries, GitHub and cloud SDKs), **Full** (any domain) and **Custom** (your own allowlist, one domain per line, `*.` wildcards, optionally plus the defaults). The default Trusted list covers Anthropic services (api.anthropic.com, claude.ai, code.claude.com...), GitHub/GitLab/Bitbucket, container registries (Docker Hub, gcr.io, ghcr.io, mcr, ECR), cloud platforms (*.googleapis.com, *.amazonaws.com, Azure), package registries (npm, yarn, PyPI, RubyGems, crates.io, Go proxy, Maven/Gradle, NuGet, Packagist, pub.dev, Hex, CPAN, CocoaPods, Hackage, Swift), Ubuntu/Launchpad/NixOS, dev tools (k8s, HashiCorp, Anaconda, Apache, Eclipse, Node.js, developer.apple.com), monitoring (Statsig, Sentry, Datadog, Honeycomb), CDNs, JSON schema hosts and *.modelcontextprotocol.io. GitHub (via its own proxy), enabled MCP connectors, network-secret hosts and the Anthropic API bypass the allowlist at any level. **Verified.**
- https://code.claude.com/docs/en/cloud-environments (sections "Network access", "Access levels", "Default allowed domains")
- https://code.claude.com/docs/en/claude-code-on-the-web (overview; links to the above)

### 13. Apple Liquid Glass Human Interface Guidelines summary
Liquid Glass is Apple's dynamic material (2025 redesign, iOS/macOS 26) that combines glass-like optics with fluidity and forms a functional layer for controls and navigation that floats above content. HIG guidance: use it for controls/navigation, **not in the content layer** (use standard materials there, except transient controls like sliders and toggles); use it sparingly; pick standard materials and vibrancy by meaning, not by colour; keep legibility and respect Reduce Transparency/accessibility settings. **Verified** (Materials page, change log: added 9 June 2025, updated 9 Sept 2025).
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/technologyoverviews/liquid-glass

### 14. Exa vs Parallel vs Tavily search API for AI agents
Open-ended: best results are recent comparison posts or benchmarks (vendor benchmark pages from Parallel or Exa, independent write-ups). Key facts: Exa is a neural index with fast/auto/deep modes, $7/1k searches; Parallel Search API targets agents with dense excerpts, pay as you go with a free monthly allowance; Tavily uses credits (1 credit basic, 2 advanced; $0.008/credit PAYG, 1,000 free credits a month). See pricing.md. **Unverified** for quality claims.

### 15. reddit Claude skills vs MCP servers when to use which
Good results are actual Reddit threads (r/ClaudeAI, r/ClaudeCode, r/mcp). Consensus: Skills are packaged instructions/scripts loaded on demand (cheap on context, good for procedures and know-how); MCP servers give live access to external systems and tools (APIs, data, actions); they combine well (a skill that tells Claude how to use an MCP server). **Unverified** (not checked in this run).

### 16. junior product designer jobs London UK
Answer is live listings (LinkedIn, Indeed UK, Welcome to the Jungle, Otta, company careers pages) for junior/associate product (UX/UI) designer roles in London. Listings change daily; judge on freshness and location. **Unverified.**

### 17. that tool that turns figma designs into a website
Best answer: **Figma Sites** (Figma's own tool: paste Figma Design frames, responsive layouts, CMS, publish). Alternatives: Framer (Figma import plugin), Anima, Locofy, Builder.io Visual Copilot, Webflow's Figma-to-Webflow plugin, Figma Make. **Verified** for Figma Sites.
- https://www.figma.com/sites/

### 18. app like notion but simpler for personal notes
Recommendation question: Apple Notes, Bear, Obsidian, Craft, Anytype, Capacities, Simplenote, Standard Notes, UpNote, Google Keep are all fair answers; Reddit threads and listicles acceptable. **Unverified** (opinion).

### 19. How to convert trimesh to a quadmesh in Blender
In Edit Mode, select all (A), then **Face > Triangles to Quads (Alt+J)**; it merges adjacent triangles using Max Face Angle / Max Shape Angle thresholds (some triangles may remain; tip: Topology Influence 100 to 130% and Max Angle 180°). For clean all-quad topology on scans/sculpts, use the **Remesh modifier (Quad, QuadriFlow)** or a retopology tool. Manual is now "Blender 5.2 LTS". **Verified** (Tris to Quads); Remesh **unverified** here.
- https://docs.blender.org/manual/en/latest/modeling/meshes/editing/face/triangles_quads.html

### 20. clade code remote enviroment acces denied
Should be read as "Claude Code remote environment access denied". Likely causes: the environment's network level (Trusted blocks non-allowlisted hosts; switch to Custom or Full, changes apply to running sessions within about a minute), or the GitHub proxy (403 "GitHub access to ... is not enabled for this session" for repos not attached; GraphQL blocked, so `gh pr`/`gh issue` fail; use `gh api repos/...`). **Verified.**
- https://code.claude.com/docs/en/cloud-environments
- https://code.claude.com/docs/en/claude-code-on-the-web
