<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { streamFounderGPS } from '../lib/groq';
  import type { LaunchpadCustomResource } from '../lib/types';

  // ── Types ────────────────────────────────────────────────────────────────
  type RType = 'podcast' | 'video' | 'playlist' | 'community' | 'tool' | 'newsletter';

  interface Resource {
    id: string; type: RType; title: string; desc: string; url: string;
    platform: string; category: string; tags: string[];
    stage: 'all' | 'pre-formation' | 'early-stage' | 'growth';
  }
  interface SOPStep { n: number; title: string; detail: string; }
  interface SOP {
    id: string; title: string; desc: string;
    stage: string; readTime: string; steps: SOPStep[];
  }
  interface NewsItem { title: string; url: string; desc: string; pubDate: string; source: string; sourceColor: string; }
  interface GpsMsg { role: 'user' | 'enzo'; text: string; ts: number; }

  // ── Static resource library ───────────────────────────────────────────────
  const RESOURCES: Resource[] = [
    // Podcasts
    { id:'p1',  type:'podcast', title:'The Long Run', desc:'Luke Timmerman interviews biotech founders, CEOs and scientists on building companies in life science. The most essential podcast in the space.', url:'https://timmermanreport.com/podcast/', platform:'Spotify · Web', category:'Founder Journey', tags:['biotech','founders','CEO'], stage:'all' },
    { id:'p2',  type:'podcast', title:'Mendelspod', desc:'Deep technical interviews on genomics, precision medicine, and biotech startups. For scientists crossing into company building.', url:'https://mendelspod.com/', platform:'Web', category:'Science & Tech', tags:['genomics','precision medicine','diagnostics'], stage:'all' },
    { id:'p3',  type:'podcast', title:'Petri — Biotech Startups', desc:'Stories of how biotech companies are created — from first idea through IND and IPO. Candid founder conversations.', url:'https://pod.link/1447042357', platform:'Spotify · Apple', category:'Founder Journey', tags:['biotech','startup','IPO'], stage:'all' },
    { id:'p4',  type:'podcast', title:'Biotech 2050', desc:'Big-picture conversations about the future of healthcare, biotech, and life sciences with founders and investors.', url:'https://biotech2050.podbean.com/', platform:'Podbean · Spotify', category:'Vision & Strategy', tags:['future','healthcare','biotech'], stage:'all' },
    { id:'p5',  type:'podcast', title:'How I Built This (NPR)', desc:'Guy Raz interviews founders of iconic companies. Essential for founder mindset, resilience under pressure, and early pivots.', url:'https://www.npr.org/series/490248027/how-i-built-this', platform:'NPR · Spotify', category:'Founder Mindset', tags:['founders','mindset','resilience','pivots'], stage:'all' },
    { id:'p6',  type:'podcast', title:'Masters of Scale', desc:'Reid Hoffman on unconventional theories for growing a business — scaling culture, counter-intuitive fundraising, early team dynamics.', url:'https://mastersofscale.com/', platform:'Spotify', category:'Growth & Strategy', tags:['scaling','strategy','leadership'], stage:'early-stage' },
    { id:'p7',  type:'podcast', title:'a16z Bio Podcast', desc:"Andreessen Horowitz bio fund on where tech meets biology — company creation playbooks, regulatory strategy, and platform company thinking.", url:'https://a16z.com/podcasts/a16z-podcast/', platform:'Spotify · Web', category:'Investor Perspective', tags:['biotech','VC','platform'], stage:'all' },
    { id:'p8',  type:'podcast', title:'BioTechNation', desc:"Dr. Moira Gunn interviews biotech innovators and scientists turning research into companies. Global perspective including European biotech.", url:'https://www.biotechnation.com/podcast', platform:'Web · Spotify', category:'Founder Journey', tags:['biotech','science','international'], stage:'all' },
    { id:'p9',  type:'podcast', title:'Acquired (Biotech Episodes)', desc:'Deep-dive company histories — Moderna, Illumina, Genentech, Pfizer. 3–5 hour case studies with full financial and scientific context.', url:'https://www.acquired.fm/', platform:'Spotify · Web', category:'Company Stories', tags:['deep-dive','history','company building'], stage:'all' },
    { id:'p10', type:'podcast', title:'The Knowledge Project', desc:"Shane Parrish on mental models, decision-making under uncertainty, and continuous learning — cognitive foundation every founder needs.", url:'https://fs.blog/knowledge-project/', platform:'Spotify', category:'Self-Development', tags:['decision-making','mental models','learning'], stage:'all' },
    { id:'p11', type:'podcast', title:'Invest Like the Best (Bio)', desc:'Patrick OShaughnessy — episodic biotech deep dives with leading investors. Good for learning investor vocabulary and thesis frameworks.', url:'https://www.joincolossus.com/episodes', platform:'Spotify', category:'Investor Perspective', tags:['VC','biotech','investing','vocabulary'], stage:'all' },
    { id:'p12', type:'podcast', title:'Startup Podcast (Gimlet)', desc:'Alex Blumberg documents founding a company in real time — the most honest, emotional account of early-stage startup struggles ever recorded.', url:'https://gimletmedia.com/shows/startup', platform:'Spotify', category:'Founder Mindset', tags:['startup','authentic','early stage'], stage:'pre-formation' },
    { id:'p13', type:'podcast', title:'Y Combinator Podcast', desc:'YC partners on fundraising, co-founders, idea validation. Listen to the "Dalton & Michael" series on startup mistakes — required listening.', url:'https://www.ycombinator.com/library', platform:'Spotify · Web', category:'Startup School', tags:['YC','fundraising','co-founders','tactics'], stage:'all' },
    { id:'p14', type:'podcast', title:'The Bio Report', desc:'Weekly news and analysis for the business of biotechnology. Keeps you current on deal flow, clinical results, and regulatory decisions.', url:'https://thebioreport.com/', platform:'Web', category:'Industry News', tags:['biotech','news','deals','regulatory'], stage:'all' },

    // Video Channels
    { id:'v1',  type:'video', title:'Y Combinator', desc:'Startup School lectures, founder interviews, office hours. "How to Start a Startup" playlist is the best free startup MBA available.', url:'https://www.youtube.com/@ycombinator', platform:'YouTube', category:'Startup School', tags:['YC','startup school','lectures'], stage:'all' },
    { id:'v2',  type:'video', title:'STAT News', desc:'Video journalism on health, medicine and biotech — FDA panels, clinical trial results, founder profiles, and science explainers.', url:'https://www.youtube.com/@statnews', platform:'YouTube', category:'Industry News', tags:['biotech','news','healthcare','clinical'], stage:'all' },
    { id:'v3',  type:'video', title:'Stanford GSB — Entrepreneurship', desc:'Stanford Business School lectures on company building and strategy. "View from the Top" series features many biotech CEOs.', url:'https://www.youtube.com/@StanfordGSB', platform:'YouTube', category:'Startup School', tags:['Stanford','entrepreneurship','leadership','CEO talks'], stage:'all' },
    { id:'v4',  type:'video', title:'a16z Channel', desc:'Andreessen Horowitz on bio + health: company creation playbooks, regulatory innovation, how to think about platform vs asset companies.', url:'https://www.youtube.com/@a16z', platform:'YouTube', category:'Investor Perspective', tags:['a16z','bio','VC','platform'], stage:'all' },
    { id:'v5',  type:'video', title:'LabCentral Founder Series', desc:'Cambridge MA life science incubator — candid founder talks, demo days, and panels from real biotech startups at formation stage.', url:'https://www.youtube.com/@labcentral', platform:'YouTube', category:'Founder Journey', tags:['biotech','incubator','Cambridge','real founders'], stage:'early-stage' },
    { id:'v6',  type:'video', title:'Biotech Primer', desc:'Accessible explainer videos on biotech science, business, and investment. Bridges scientist vocabulary to startup world.', url:'https://www.youtube.com/@BiotechPrimer', platform:'YouTube', category:'Science & Tech', tags:['explainer','vocabulary','science to business'], stage:'pre-formation' },
    { id:'v7',  type:'video', title:'TED — Health & Medicine', desc:'Curated TED talks from cancer researchers, genomics pioneers, and health innovators. Good for vision and pitch inspiration.', url:'https://www.youtube.com/playlist?list=PLbLbu_eGNBBCxmRB4WaCQWN72fVPRE0oW', platform:'YouTube', category:'Vision & Strategy', tags:['TED','cancer','innovation','pitch inspiration'], stage:'all' },
    { id:'v8',  type:'video', title:'First Round Capital', desc:'Tactical startup advice from seed investors — hiring first team, building culture, product thinking, and "Ask Me Anything" series.', url:'https://www.youtube.com/@FirstRoundCapital', platform:'YouTube', category:'Investor Perspective', tags:['seed','hiring','culture','product'], stage:'early-stage' },
    { id:'v9',  type:'video', title:'MIT Entrepreneurship Center', desc:"MIT's Martin Trust Center for Entrepreneurship — biomedical ventures, regulatory strategy, and deep tech company creation courses.", url:'https://www.youtube.com/@MITOpenCourseWare', platform:'YouTube', category:'Startup School', tags:['MIT','biomedical','deep tech','courses'], stage:'all' },
    { id:'v10', type:'video', title:'Endpoints News Video', desc:'Short news videos on drug development, clinical trials and M&A from one of biotech\'s most-read trade publications.', url:'https://www.youtube.com/c/EndpointsNews', platform:'YouTube', category:'Industry News', tags:['news','clinical trials','M&A','pharma'], stage:'all' },

    // Playlists
    { id:'pl1', type:'playlist', title:'YC Startup School 2024 (Full Series)', desc:'20+ lectures from Y Combinator\'s 2024 Startup School — idea validation, co-founders, fundraising, and growth. The essential free startup curriculum.', url:'https://www.ycombinator.com/library', platform:'YouTube', category:'Startup School', tags:['YC','full course','fundraising','validation'], stage:'all' },
    { id:'pl2', type:'playlist', title:'How to Start a Startup — Stanford CS183B', desc:"Sam Altman's legendary Stanford lecture series with YC partners, Peter Thiel, Dustin Moskovitz and others. 20 essential lectures.", url:'https://www.youtube.com/playlist?list=PLQ-uHSnFig5MaafmEh1-1DVsD9SDVV0Qd', platform:'YouTube', category:'Startup School', tags:['Stanford','Sam Altman','fundamentals'], stage:'pre-formation' },
    { id:'pl3', type:'playlist', title:'NIH SBIR/STTR Application Tutorial', desc:'Official NIH video series on SBIR/STTR grants — eligibility, writing specific aims, submission systems, and post-award reporting.', url:'https://www.youtube.com/results?search_query=NIH+SBIR+STTR+tutorial', platform:'YouTube', category:'Funding', tags:['SBIR','STTR','NIH','grants','application writing'], stage:'early-stage' },
    { id:'pl4', type:'playlist', title:'Endpoints News Founder Conversations', desc:'Video interviews with biotech founders — drug discovery origins, financing strategies, and hard lessons from the front line.', url:'https://www.youtube.com/c/EndpointsNews', platform:'YouTube', category:'Founder Journey', tags:['biotech','founders','drug discovery','financing'], stage:'all' },
    { id:'pl5', type:'playlist', title:'Women in Life Science Leadership', desc:'Panel discussions and keynotes featuring women founding and leading biotech and medtech companies. WIB, WLSA, and EWIT conference talks.', url:'https://www.youtube.com/results?search_query=women+life+science+biotech+founder+leadership', platform:'YouTube', category:'Founder Journey', tags:['women','diversity','leadership','panels'], stage:'all' },

    // Communities
    { id:'c1',  type:'community', title:'Nucleate', desc:'The best global community for PhD/postdoc-led biotech startups. 30+ chapters worldwide, hands-on training, deal flow, and a tight academic founder alumni network.', url:'https://nucleate.xyz/', platform:'Web', category:'Academic Founders', tags:['PhD','postdoc','academic','training','global'], stage:'pre-formation' },
    { id:'c2',  type:'community', title:'Nucleate Heidelberg / European Hub', desc:'The European chapter network of Nucleate — active in Heidelberg, Basel, and Munich. Direct peer community for German life science academics transitioning to startups.', url:'https://nucleate.xyz/chapters', platform:'Web', category:'Academic Founders', tags:['Heidelberg','Europe','Germany','local','academic'], stage:'pre-formation' },
    { id:'c3',  type:'community', title:'LabCentral (Cambridge MA)', desc:'Premier life science incubator — subsidised lab space, events, CRO access, dense founder/investor network. Competitive application, worth applying from Europe too.', url:'https://www.labcentral.org/', platform:'Physical + Web', category:'Incubator', tags:['lab space','Cambridge','incubator','network'], stage:'early-stage' },
    { id:'c4',  type:'community', title:'IndieBio (SOSV)', desc:"World's largest biotech accelerator. 3-month program, $250K initial investment, wet lab access in NYC/SF. 400+ portfolio companies, many from academic labs.", url:'https://indiebio.co/', platform:'Web', category:'Accelerator', tags:['accelerator','wet lab','investment','program'], stage:'early-stage' },
    { id:'c5',  type:'community', title:'Y Combinator (Bio Track)', desc:"YC has funded 100+ bio companies. Apply for the standard batch. YC treats bio companies like any other — which is refreshing and powerful for academic founders.", url:'https://www.ycombinator.com/apply', platform:'Web', category:'Accelerator', tags:['YC','accelerator','funding','network'], stage:'early-stage' },
    { id:'c6',  type:'community', title:'EIT Health (European Network)', desc:'EU-funded health innovation network — accelerator programs, funding instruments, and events for European life science startups. Directly relevant for Heidelberg.', url:'https://eithealth.eu/', platform:'Web', category:'European Ecosystem', tags:['EU','European','Heidelberg','funding','health'], stage:'all' },
    { id:'c7',  type:'community', title:'AUTM — Tech Transfer', desc:'Association of University Technology Managers. Essential for understanding university IP processes, licensing terms, and connecting with your institution\'s TTO contacts.', url:'https://autm.net/', platform:'Web', category:'IP & Legal', tags:['TTO','IP','licensing','university','inventor'], stage:'pre-formation' },
    { id:'c8',  type:'community', title:'Life Science Nation', desc:'Investor-company matchmaking for life science. Their RESI conferences connect founders with 500+ investors. Good for first investor relationship building.', url:'https://www.lifesciencenation.com/', platform:'Web', category:'Fundraising', tags:['investors','conferences','matchmaking','RESI'], stage:'early-stage' },
    { id:'c9',  type:'community', title:'BioSlack Community', desc:'Active Slack community for biotech professionals. Channels for jobs, science, startup advice, and funding. Good for informal advice from practitioners.', url:'https://bioslack.com/', platform:'Slack', category:'Online Community', tags:['Slack','online','informal','jobs','advice'], stage:'all' },
    { id:'c10', type:'community', title:'r/biotech (Reddit)', desc:'Active community for biotech industry discussion — career questions, company culture, science news. Honest, unfiltered perspectives you won\'t get at conferences.', url:'https://www.reddit.com/r/biotech/', platform:'Reddit', category:'Online Community', tags:['reddit','biotech','honest','unfiltered'], stage:'all' },
    { id:'c11', type:'community', title:'LinkedIn: Biotech Entrepreneurs', desc:'50K+ members sharing insights, job postings, research news, and funding announcements. Useful for warm introductions and staying visible in the ecosystem.', url:'https://www.linkedin.com/groups/57181/', platform:'LinkedIn', category:'Network', tags:['LinkedIn','network','visibility','warm intros'], stage:'all' },
    { id:'c12', type:'community', title:'BioEntrepreneur (Nature)', desc:"Nature's hub for academic founders — articles, career guides, and success stories. The legitimising source for researchers who feel imposter syndrome about startups.", url:'https://www.nature.com/bioent', platform:'Web', category:'Academic Founders', tags:['Nature','academic','legitimacy'], stage:'all' },

    // Tools
    { id:'t1',  type:'tool', title:'SBIR.gov', desc:'Official US portal for SBIR/STTR grants — search open solicitations, find program officers, browse the award database. Start here before any NIH application.', url:'https://www.sbir.gov/', platform:'Web · Free', category:'Funding', tags:['SBIR','STTR','NIH','NSF','grants','non-dilutive'], stage:'early-stage' },
    { id:'t2',  type:'tool', title:'Benchling', desc:'Electronic lab notebook and R&D platform — the industry standard. Free academic tier. Start now so your lab data is organised when you spin out.', url:'https://www.benchling.com/', platform:'Web · Free academic', category:'Science Ops', tags:['ELN','lab notebook','R&D','data management'], stage:'all' },
    { id:'t3',  type:'tool', title:'Google Patents', desc:'Free comprehensive patent search. Essential for freedom-to-operate analysis, prior art search, and mapping the competitive IP landscape before filing.', url:'https://patents.google.com/', platform:'Web · Free', category:'IP & Legal', tags:['patents','IP','prior art','FTO','free'], stage:'pre-formation' },
    { id:'t4',  type:'tool', title:'Crunchbase', desc:'Startup and investor database — research competitors, track funding rounds, find relevant VC firms, see founding team compositions for comparable companies.', url:'https://www.crunchbase.com/', platform:'Web · Free tier', category:'Market Research', tags:['market research','investors','competitors','funding rounds'], stage:'all' },
    { id:'t5',  type:'tool', title:'ClinicalTrials.gov', desc:'Complete registry of all clinical trials worldwide. Understand your competitive landscape, regulatory precedents, and what Phase II designs FDA has accepted.', url:'https://clinicaltrials.gov/', platform:'Web · Free', category:'Regulatory', tags:['clinical trials','regulatory','FDA','competitive landscape'], stage:'all' },
    { id:'t6',  type:'tool', title:'NIH Reporter', desc:'Search all NIH-funded research — identify grants in your area, find collaborators, see funding amounts, spot competitor academics before they become competitor companies.', url:'https://reporter.nih.gov/', platform:'Web · Free', category:'Research & Funding', tags:['NIH','grants','collaborators','competitors'], stage:'all' },
    { id:'t7',  type:'tool', title:'Stripe Atlas', desc:'Incorporate a Delaware C-Corp online in 1–2 days for $500 flat. EIN, standard equity documents, Stripe account, and registered agent for year one included.', url:'https://stripe.com/atlas', platform:'Web · $500', category:'Formation', tags:['incorporation','Delaware','C-Corp','EIN','equity'], stage:'pre-formation' },
    { id:'t8',  type:'tool', title:'AngelList', desc:'Connect with angel investors, manage cap table via Roll Up Vehicles, and post jobs. Most early-stage biotech rounds include some AngelList investors.', url:'https://www.angellist.com/', platform:'Web · Free', category:'Fundraising', tags:['angels','investors','cap table','jobs'], stage:'early-stage' },
    { id:'t9',  type:'tool', title:'Canva — Pitch Deck', desc:'Free professional pitch deck templates including life science and biotech layouts. Good for first draft — replace with Pitch.com before serious investor meetings.', url:'https://www.canva.com/presentations/templates/', platform:'Web · Free', category:'Pitch & Comms', tags:['pitch deck','design','templates','free'], stage:'pre-formation' },
    { id:'t10', type:'tool', title:'Quartzy', desc:'Free lab inventory and ordering management. Keep reagents, equipment, and orders organised. Scales cleanly from academic lab to startup.', url:'https://www.quartzy.com/', platform:'Web · Free', category:'Science Ops', tags:['lab inventory','orders','reagents','free'], stage:'early-stage' },
    { id:'t11', type:'tool', title:'Grants.gov', desc:'All US federal grant opportunities — beyond NIH: NSF, BARDA, DARPA, DOE, and ARPA-H. Set up email alerts for your keywords.', url:'https://www.grants.gov/', platform:'Web · Free', category:'Funding', tags:['grants','federal','NSF','BARDA','ARPA-H'], stage:'all' },
    { id:'t12', type:'tool', title:'FDA Drug Approval Database', desc:'Track precedent drug and device approvals. Understand which oncology indications used Accelerated Approval, Orphan Drug, or Breakthrough Therapy pathways.', url:'https://www.fda.gov/drugs/drug-approvals-and-databases', platform:'Web · Free', category:'Regulatory', tags:['FDA','approval history','oncology','pathway'], stage:'all' },
    { id:'t13', type:'tool', title:'DocSend', desc:'Send pitch decks with granular viewer analytics — which slides investors opened, time spent per slide, whether it was forwarded. Standard tool for Series A outreach.', url:'https://www.docsend.com/', platform:'Web · Paid', category:'Pitch & Comms', tags:['pitch deck','analytics','investor outreach','tracking'], stage:'early-stage' },
    { id:'t14', type:'tool', title:'Notion', desc:'All-in-one workspace for internal docs, wikis, and project management. Many early-stage biotech startups use it as their operating system before ops hires.', url:'https://www.notion.so/', platform:'Web · Free tier', category:'Operations', tags:['docs','wiki','project management','team'], stage:'all' },
    { id:'t15', type:'tool', title:'Carta', desc:'Cap table management and equity administration. Essential from day one — a clean cap table prevents enormous pain in Series A due diligence.', url:'https://carta.com/', platform:'Web · Paid', category:'Legal & Finance', tags:['cap table','equity','due diligence','clean records'], stage:'early-stage' },

    // Newsletters
    { id:'n1', type:'newsletter', title:'STAT News', desc:'The highest-quality daily biotech and health news. FDA decisions, clinical results, founder profiles, and policy. Subscribe free — the essential daily read.', url:'https://www.statnews.com/sign-up/', platform:'Email · Free', category:'Industry News', tags:['daily','FDA','clinical','founders','free'], stage:'all' },
    { id:'n2', type:'newsletter', title:'Endpoints News', desc:'Biotech drug development news focused on clinical trial results, deals, and company milestones. The morning brief is concise and authoritative.', url:'https://endpts.com/', platform:'Email · Free', category:'Industry News', tags:['drug development','clinical','deals','daily'], stage:'all' },
    { id:'n3', type:'newsletter', title:'FierceBiotech Newsletter', desc:'Daily biotech briefing — funding rounds, partnerships, clinical results, M&A. Broad coverage, useful for competitive landscape monitoring.', url:'https://www.fiercebiotech.com/newsletters', platform:'Email · Free', category:'Industry News', tags:['funding','M&A','partnerships','daily'], stage:'all' },
    { id:'n4', type:'newsletter', title:'Rock Health Digest', desc:'Digital health VC quarterly funding reports and market analysis. Best data source for health tech investment trends and startup spotlights.', url:'https://rockhealth.com/insights/', platform:'Email · Free', category:'Health Tech', tags:['digital health','VC','funding data','quarterly'], stage:'all' },
    { id:'n5', type:'newsletter', title:'Timmerman Report', desc:"Luke Timmerman's deep, opinionated essays on biotech company building and science. The best long-form analysis in biotech — subscriber paid.", url:'https://timmermanreport.com/', platform:'Email · Paid', category:'Analysis', tags:['deep analysis','company building','opinion','biotech'], stage:'all' },
    { id:'n6', type:'newsletter', title:'LifeSciVC Blog', desc:"Atlas Venture partner Bruce Booth's essays on biotech VC, company creation philosophy, and strategy. Must-read to understand how VCs actually think.", url:'https://lifescivc.com/', platform:'Email · Free', category:'VC Perspective', tags:['VC thinking','company creation','strategy','Atlas'], stage:'all' },
    { id:'n7', type:'newsletter', title:'BioPharma Dive', desc:'Industry news and analysis for biopharma — regulatory strategy, business deals, pipeline updates. Especially good for competitive intelligence.', url:'https://www.biopharmadive.com/newsletters/', platform:'Email · Free', category:'Industry News', tags:['biopharma','regulatory','competitive intel','pipeline'], stage:'all' },
    { id:'n8', type:'newsletter', title:'Nature Biotechnology News & Views', desc:"High-quality scientific and business coverage of biotech from Nature's editorial team — peer-reviewed context for major technological developments.", url:'https://www.nature.com/nbt', platform:'Email · Free tier', category:'Science & Tech', tags:['Nature','peer-reviewed','technology','scientific'], stage:'all' },
  ];

  const SOPS: SOP[] = [
    {
      id:'s1', stage:'Pre-Formation', readTime:'12 min',
      title:'Lab to Company: The First 90 Days',
      desc:'The critical transition from researcher to founder. What to do, what to avoid, and how to do it without burning your academic career.',
      steps:[
        { n:1, title:'Identify your translational gap', detail:'Write a single paragraph: what is the clinical problem, who are the patients, what does the current standard of care fail to address, and how does your technology specifically close that gap. If you cannot write this paragraph clearly, stop here — this clarity is the entire foundation.' },
        { n:2, title:'Have the PI conversation early', detail:'Have a direct, honest conversation with your PI before doing anything public. Discuss IP ownership, your role after spin-out, shared credit, and whether they might be a co-founder or advisor. Getting this wrong early can end careers and friendships.' },
        { n:3, title:'File an Invention Disclosure Form (IDF)', detail:"Contact your institution's Technology Transfer Office (TTO) and file an IDF immediately — before any public disclosure, conference presentation, or preprint. Filing protects your priority date." },
        { n:4, title:'Attend 3 pitch events as an observer', detail:'Go to local biotech pitch competitions, demo days, or startup panels as a spectator before you pitch anything. Watch how founders frame problems, answer hard questions, and talk to investors. In Heidelberg: BioMed X, EIT Health Germany events.' },
        { n:5, title:'Build a clinical expert network', detail:'Identify 2–3 oncologists or clinical researchers who could validate your problem statement and serve as clinical advisors. A single warm intro from a practicing clinician carries more weight than 10 pages of preclinical data in early investor conversations.' },
        { n:6, title:'Define your minimum viable experiment', detail:'What is the one experiment that would most efficiently de-risk your core hypothesis for an investor or Phase I application? Design it, budget it, and prioritise it above all other lab work. This becomes your Phase I SBIR Aim 1 or your Seed milestone.' },
        { n:7, title:'Do competitive intelligence properly', detail:'Search ClinicalTrials.gov for your indication, Google Patents for your mechanism, Crunchbase for funded companies in the space, and PubMed for recent clinical papers. Build a simple 2×2 comparing your approach to the top 3 alternatives on efficacy and safety axes.' },
        { n:8, title:'Apply to a structured academic founder program', detail:'Apply to Nucleate (global, PhD/postdoc focus), NSF I-Corps (mandatory for NSF SBIR), or a local incubator (EIT Health, BioMed X Innovation Center in Heidelberg). These programs teach startup fundamentals without abandoning your academic frame.' },
        { n:9, title:'Build your founding team hypothesis', detail:'Every biotech needs a scientist, an operator, and a clinician in some combination. Who is your co-founder? Do you have a business-oriented partner? Nucleate and academic founder communities are the best places to find science-literate operators.' },
        { n:10, title:'Write a one-page company concept brief', detail:'One page: problem, technology solution, IP status, unmet need (patient numbers), your team, and what you need in the next 6 months. This is your first pitch document. Iterate it every 30 days.' },
      ]
    },
    {
      id:'s2', stage:'Pre-Formation', readTime:'10 min',
      title:'University IP & Technology Transfer',
      desc:"Navigating your institution's TTO: invention disclosure, licensing vs assignment, equity splits, and spinning out technology legally and amicably.",
      steps:[
        { n:1, title:'Locate your TTO and licensing manager', detail:"Every research university has a TTO (also called OTT, OTC, or Innovation office). Search your institution's website or ask the department administrator. Get the name of the licensing manager who covers your department — this person is your key relationship." },
        { n:2, title:"Understand what your institution owns", detail:"Most IP policies state that inventions made using institutional resources belong to the institution. Read your employment contract's IP assignment clause. If on a DFG or EU grant, additional terms apply. Know the rules before acting." },
        { n:3, title:'File an Invention Disclosure immediately', detail:"The IDF is a confidential, internal document. It describes your invention, all contributors (all co-inventors must be named — omitting someone is a serious legal error), relevant publications, and funding sources. File it before any public disclosure." },
        { n:4, title:'Understand licensing vs assignment', detail:"In a license, the institution retains ownership and grants you rights. In an assignment, full ownership transfers to the startup. Most European TTOs license; negotiate for an exclusive license in your field of use and geography." },
        { n:5, title:'Negotiate the key license terms', detail:'Focus on: exclusivity (essential for biotech), field of use (keep it broad), territory (worldwide), royalty rate (2–5% of net sales), sublicense rights (you need these for partnerships), and milestone payments (keep them achievable). Get a startup-specialised IP attorney to review.' },
        { n:6, title:'Clarify the equity arrangement', detail:'Institutions typically take 2–10% equity in the spin-out in exchange for the license. This dilutes alongside founders in future rounds. Negotiate this number — it is not fixed. Some institutions waive equity for an equity-free royalty instead.' },
        { n:7, title:'Confirm publication and grant obligations', detail:'Your license should include a right to publish after a short IP review period (30–60 days). Confirm that your license does not violate NIH, DFG, or ERC grant obligations — speak to your grants office in parallel.' },
        { n:8, title:'Address co-inventor obligations', detail:'All inventors on the patent must sign assignment documents. If a co-inventor is reluctant, this can block licensing. Resolve early. Inventors typically receive 33–50% of the institution\'s royalty income.' },
        { n:9, title:'Get a startup-focused IP attorney', detail:"Do not use your institution's attorney for the spin-out negotiation — they represent the institution, not you. Find an IP attorney who specialises in life science spinouts." },
        { n:10, title:'Keep rigorous laboratory notebooks', detail:'Date every entry. Have lab notebooks witnessed by a co-worker not involved in the invention. Digital ELNs (Benchling, LabArchives) with timestamps are increasingly accepted. Rigorous records are your defence against inventorship disputes.' },
      ]
    },
    {
      id:'s3', stage:'Pre-Formation', readTime:'8 min',
      title:'Entity Formation for Biotech',
      desc:"Why Delaware C-Corp is almost always right, how to incorporate in 48 hours, cap table fundamentals, and the 83(b) election you must not miss.",
      steps:[
        { n:1, title:'Choose Delaware C-Corp', detail:'Delaware C-Corp is standard for VC-backed startups globally — including European founders raising US capital. German GmbH or British Ltd are acceptable for European seed rounds but convert before a US Series A.' },
        { n:2, title:'Check name availability', detail:'Pick 3 options. Check: Delaware Division of Corporations, USPTO trademark database, domain availability (.com preferred), and EU trade mark registries if operating in Europe.' },
        { n:3, title:'Incorporate via Stripe Atlas or Clerky', detail:'Stripe Atlas ($500) — Delaware C-Corp in 1–2 days with EIN, standard equity documents, Stripe account, and registered agent for year one. Clerky (~$500) is similar. A startup attorney costs $1,500–3,000 for complex cap tables.' },
        { n:4, title:'Issue founder shares immediately', detail:'Issue shares the day you incorporate. Standard: 8–10M shares at $0.00001 par value. Set a vesting schedule: 4-year total, 1-year cliff.' },
        { n:5, title:'File an 83(b) election within 30 days — CRITICAL', detail:"THIS CANNOT BE MISSED. When you receive restricted stock subject to vesting, file IRS Form 83(b) within 30 days of the grant date to be taxed at grant value (near zero) rather than at vesting (potentially millions). Missing this window is permanent." },
        { n:6, title:'Open a business bank account', detail:'Mercury (mercury.com) is the standard — fully online, no minimums, integrates with cap table tools. Open within the first week.' },
        { n:7, title:'Set up basic accounting', detail:'Bench, Pilot, or QuickBooks. Keep personal and company finances strictly separate from day one. Clean books make grant audits and investor due diligence dramatically easier.' },
        { n:8, title:'Build your cap table in Carta', detail:"Carta is the industry standard. Set it up now, even with just 2 founders and a $0 balance sheet. A messy cap table is one of the most common Series A deal-killers." },
        { n:9, title:'Sign CIIA agreements', detail:'Every founder must sign a Confidential Information and Invention Assignment Agreement assigning all relevant IP to the company. Included in Atlas/Clerky document packages. Non-optional.' },
        { n:10, title:'Establish a Stockholders Agreement', detail:"Covers co-founder disputes, right of first refusal on share transfers, drag-along and tag-along rights. Use NVCA standard documents (nvca.org) — free and investor-expected." },
      ]
    },
    {
      id:'s4', stage:'Early Stage', readTime:'11 min',
      title:'SBIR/STTR: The Non-Dilutive Path',
      desc:'Phase I vs Phase II, NIH vs NSF vs BARDA, finding your Program Officer, and what makes a winning life science application.',
      steps:[
        { n:1, title:'Understand SBIR vs STTR', detail:'SBIR: >50% of funded work done by the small business. STTR: requires a formal collaboration with a research institution (your university works here) — at least 30% by the small business, 30% by the research institution. As an academic founder, STTR often fits better in early phase.' },
        { n:2, title:'Identify your funding agency and topic', detail:'Search SBIR.gov. NIH is primary for cancer therapeutics and biomedical tools — identify the most relevant Institute (NCI for cancer). NSF funds enabling technologies and platforms. BARDA funds MCMs. ARPA-H funds high-risk biomedical R&D.' },
        { n:3, title:'Contact the Program Officer before submitting', detail:'This is expected, not pushy. Email the PO listed on the solicitation with a 2-paragraph summary of your technology. PO feedback can save weeks of misdirected work. POs want to fund good science — they are on your side.' },
        { n:4, title:'Complete NSF I-Corps if targeting NSF', detail:'I-Corps is mandatory for NSF SBIR. The program requires 100 customer discovery interviews in 6 weeks. It forces market validation in real time — more valuable than the $50K I-Corps award itself.' },
        { n:5, title:'Structure your Phase I application', detail:'NIH Phase I: up to $300K, 1 year. Key components: Specific Aims (1 page — most important), Research Strategy (Significance, Innovation, Approach — 6 pages), commercialisation plan, and investigator biosketch.' },
        { n:6, title:'Write the Specific Aims page last', detail:'Write the grant body first, then distil it into the Aims page. It must stand alone: problem, gap, your approach, 2–3 specific aims with measurable milestones. Use a scientific writer or SBIR consulting service for review before submission.' },
        { n:7, title:'Budget to the maximum', detail:'Phase I NIH: $300K direct. Phase II NIH: up to $2M. Underspending signals lack of experience. Include personnel, reagents, CRO costs, IP filing costs, and 10% contingency.' },
        { n:8, title:'Use STTR if still affiliated with university', detail:'The STTR mechanism allows you to remain a part-time university employee, collaborate with your current lab, and share resources — ideal for academic founders in transition.' },
        { n:9, title:'Consider Fast-Track mechanism', detail:'Fast-Track combines Phase I and Phase II in a single application. Best used when you already have significant data and need to move quickly toward IND.' },
        { n:10, title:'Hire SBIR-experienced accounting before award', detail:'SBIR awards have strict federal cost accounting requirements. Budget $2–4K/year in SBIR-specific accounting from day one of the award.' },
      ]
    },
    {
      id:'s5', stage:'Early Stage', readTime:'9 min',
      title:'Building Your Scientific Advisory Board',
      desc:'How to recruit your first 3–5 SAB members, what to offer them, running effective meetings, and making SAB relationships genuinely valuable.',
      steps:[
        { n:1, title:'Define expertise gaps first', detail:'Before identifying names, list 4–6 specific questions your SAB must help you answer in the next 18 months. Each gap maps to an advisor profile. Examples: Phase I trial design, regulatory strategy, CMC scale-up, KOL credibility for investors.' },
        { n:2, title:'Target the right profile mix', detail:'Ideal oncology SAB: 1 practicing clinical oncologist (KOL in your indication), 1 translational scientist in your mechanism, 1 former pharma/biotech CSO-level executive, 1 regulatory specialist (ex-FDA or IND-experienced), 1 optional patient advocate.' },
        { n:3, title:'Cold outreach works — use a 3-paragraph format', detail:'Para 1: who you are, your technology, the clinical problem. Para 2: why specifically you want them (cite their paper or company). Para 3: a 30-minute intro call. Attach a 1-page company brief. Well-targeted cold emails to scientists get 40–60% response rates.' },
        { n:4, title:'Offer standard equity compensation', detail:'SAB equity: 0.1–0.5% with 4-year vesting, 1-year cliff. For senior KOLs or former CSOs: 0.25–0.75%. Cash optional at early stage — $500–1,500 per quarterly call from Series A onward. Always use an SAB agreement.' },
        { n:5, title:'Be explicit about time commitment', detail:'State clearly upfront: quarterly video call (90 min), annual in-person meeting (half-day), email availability (2–3 questions per month), and ability to be named in grants and investor materials.' },
        { n:6, title:'Use NVCA standard advisor agreements', detail:'The NVCA publishes free standard advisor agreements at nvca.org. Investor-expected and do not require expensive custom drafting. Key clauses: IP assignment, confidentiality, vesting, removal for cause.' },
        { n:7, title:'Run structured quarterly SAB meetings', detail:'Agenda: 20-min company update → 40-min deep dive on a specific question (pre-circulate materials 1 week ahead) → 20-min open Q&A → 10-min action items. Always send a written follow-up within 48 hours.' },
        { n:8, title:'Brief advisors before major milestones', detail:'Before a fundraising round, regulatory meeting, key clinical design decision, or partnership negotiation — proactively brief your SAB. They become powerful advocates when genuinely informed.' },
        { n:9, title:'Pay travel and expenses promptly', detail:'Always cover travel, accommodation, and meals for in-person meetings. Process reimbursements within 2 weeks. Delayed expenses create disproportionate negative impressions.' },
        { n:10, title:'Refresh the SAB as you scale', detail:'The SAB that serves you at preclinical is different from what you need at IND or Phase II. Plan to evolve every 18–24 months. Rotating advisors out gracefully is normal company maturation.' },
      ]
    },
    {
      id:'s6', stage:'Early Stage', readTime:'10 min',
      title:'Life Science Pitch Deck Blueprint',
      desc:"The 12-slide structure for a biotech seed or Series A pitch. Each slide's purpose, what investors look for, and what kills deals at each position.",
      steps:[
        { n:1, title:'Slide 1 — Cover: the hook in one line', detail:'Company name, logo, tagline that states the problem or opportunity in plain English. No jargon. Example: "Preventing chemotherapy resistance in ovarian cancer by targeting the immunosuppressive niche." The tagline must make a non-specialist investor curious enough to turn to slide 2.' },
        { n:2, title:'Slide 2 — Problem: patient reality first', detail:'Tell the patient story first, then back with numbers. Who are these patients? What happens under current treatment? What is the failure mode? Then: market size (population × treatment cost), current standard of care, and the critical gap. Max 3 data points.' },
        { n:3, title:'Slide 3 — Solution: mechanism in one diagram', detail:'One clear mechanism of action diagram. Show how your technology intervenes at the point of failure from slide 2. One sentence: what it does, how it does it differently. A well-informed non-specialist should be able to paraphrase it.' },
        { n:4, title:'Slide 4 — Science & Data: your strongest result', detail:'Lead with your single most compelling data point. Then 2–3 supporting experiments. Clear figures with error bars and statistics. State what each figure proves in one sentence. Do not oversell — state what remains to be proven.' },
        { n:5, title:'Slide 5 — Clinical & Regulatory Path', detail:'Timeline from current stage to first-in-human. Show: IND submission date, Phase I design, Phase II endpoint strategy. If applicable: Breakthrough Therapy, Fast Track, Orphan Drug opportunities. Keep it realistic — optimistic timelines destroy credibility.' },
        { n:6, title:'Slide 6 — Market Opportunity', detail:'Bottom-up market sizing: number of eligible patients × annual treatment cost = serviceable market. Reference comparable approvals for pricing precedent (e.g., olaparib reimbursement in BRCA+ HGSOC). Avoid citing $X billion market reports without explaining your share.' },
        { n:7, title:'Slide 7 — Competition: differentiation map', detail:'A 2×2 or bubble chart mapping competitors on 2–3 clinically meaningful axes. Name competitors explicitly — pretending they do not exist destroys credibility. Your differentiation must be compelling in context.' },
        { n:8, title:'Slide 8 — Business Model & Partnering', detail:'Build to Phase II → pharma partnership (most common for academic spinouts), or build to approval. Name 3–5 potential pharma partners and why. State the trigger points for BD outreach.' },
        { n:9, title:'Slide 9 — Team: domain expertise', detail:'Founders + key SAB members. For each: 1–2 line bio focused on why they are right for this specific company. Relevant exits, publications, regulatory filings, or clinical trial experience. This slide can overcome weak data or tank strong data.' },
        { n:10, title:'Slide 10 — Milestones & Use of Funds', detail:'18–24 month milestone roadmap. Each milestone: de-risks a scientific/clinical question, increases valuation, positions for next financing. Tie each to a budget allocation.' },
        { n:11, title:'Slide 11 — IP Status', detail:'Patent applications filed, key claims, expiry dates. One line on freedom-to-operate. Exclusivity period. Keep to 3–4 bullets — detailed IP analysis belongs in the data room.' },
        { n:12, title:'Slide 12 — The Ask', detail:'Round size, instrument (SAFE/convertible/priced equity with terms), what capital achieves (milestone or inflection event), timeline to close, and current investor status. Investors respect specificity here.' },
      ]
    },
    {
      id:'s7', stage:'All Stages', readTime:'13 min',
      title:'FDA Pathway Primer for Cancer Therapeutics',
      desc:'IND, Phase I/II/III, BLA/NDA, Breakthrough Therapy, Fast Track, Accelerated Approval, and Orphan Drug — explained for biotech founders.',
      steps:[
        { n:1, title:'Identify your product type and regulatory centre', detail:'Small molecule / NDA → CDER. Biologic (antibody, cell therapy, gene therapy) / BLA → CBER or CDER. Medical device → CDRH. For most oncology therapeutics: CDER Office of Oncology Products. Identifying the right centre determines everything else.' },
        { n:2, title:'Request a Pre-IND meeting early', detail:"The Pre-IND meeting (Type B meeting) is arguably the most valuable FDA interaction you will have. Request it once you have preliminary CMC and toxicology data. FDA's written response directly shapes your Phase I protocol." },
        { n:3, title:'Apply for Fast Track Designation', detail:"Fast Track: available for drugs addressing serious conditions with unmet need. Apply as soon as you have Phase I protocol and sufficient preclinical data. Benefits: rolling review, more frequent FDA meetings, eligibility for Accelerated Approval and Priority Review." },
        { n:4, title:'Apply for Breakthrough Therapy Designation if your data supports it', detail:"BTD requires preliminary clinical evidence of substantial improvement on a clinically meaningful endpoint. Apply with Phase I dose-expansion data if you have a strong efficacy signal. Benefits: intensive FDA guidance and a 6-month Priority Review voucher upon approval." },
        { n:5, title:'Design your Phase I for oncology', detail:'Oncology Phase I: open-label dose escalation (3+3 or mTPI-2 designs), primary endpoint = safety/MTD, secondary endpoints = PK/PD and preliminary efficacy in expansion cohorts. For immuno-oncology: delayed DLTs require specific criteria. Consider biomarker enrichment from the start.' },
        { n:6, title:'Apply for Orphan Drug Designation', detail:'HGSOC qualifies for ODD — fewer than 200,000 US cases annually. Benefits: 7 years US market exclusivity post-approval, 50% tax credit on clinical trial costs (US companies), waived BLA/NDA fees, and FDA protocol assistance.' },
        { n:7, title:'Understand Accelerated Approval for oncology', detail:"Accelerated Approval based on surrogate endpoint (ORR, PFS). Post-marketing confirmatory trials required. FDA has recently tightened AA requirements — your Phase II must be designed to convert to regular approval if AA is your path." },
        { n:8, title:'Plan biomarker strategy from preclinical stage', detail:'Identify your companion diagnostic or patient selection biomarker early. For HRD-based selection in HGSOC, align with an IVD partner (Foundation Medicine, Myriad) before Phase I. Retrospective biomarker analyses on banked Phase I samples are increasingly expected.' },
        { n:9, title:'Engage EMA in parallel', detail:"For Heidelberg-based companies, EMA is the primary regulatory authority. EMA's Scientific Advice procedure is equivalent to a Type B FDA meeting. Apply for EMA Scientific Advice and PRIME designation (analogous to BTD) in parallel with FDA Fast Track." },
        { n:10, title:'Hire a regulatory affairs consultant before your first FDA meeting', detail:'Hire a regulatory consultant with oncology IND experience before your first FDA meeting. Regulatory missteps in Phase I — wrong DLT criteria, inadequate CMC package — cost 12–18 months of delay. Prevention cost is trivial compared to a clinical hold.' },
      ]
    },
  ];

  // ── UI state ──────────────────────────────────────────────────────────────
  let activeTab = $state<'resources' | 'sops' | 'news' | 'saved'>('resources');
  let typeFilter = $state('all');
  let stageFilter = $state('all');
  let search = $state('');
  let selectedSOP = $state<SOP | null>(null);
  let selectedSOPStep = $state<number | null>(null);

  // ── Enzo GPS state ────────────────────────────────────────────────────────
  let gpsOpen = $state(false);
  let gpsMessages = $state<GpsMsg[]>([]);
  let gpsInput = $state('');
  let gpsStreaming = $state(false);
  let gpsAbort: AbortController | null = null;
  let gpsContainer: HTMLElement;

  // ── News state ────────────────────────────────────────────────────────────
  let newsItems = $state<NewsItem[]>([]);
  let newsLoading = $state(false);
  let newsError = $state('');

  // ── Add custom resource ───────────────────────────────────────────────────
  let showAdd = $state(false);
  let addTitle = $state('');
  let addUrl = $state('');
  let addDesc = $state('');
  let addType = $state('tool');

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout>;

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast = ''; }, 2200);
  }

  // ── Derived filtered resources ────────────────────────────────────────────
  const allItems: (Resource | (LaunchpadCustomResource & { type: string }))[] = $derived.by(() => {
    const custom = store.launchpadCustom.map(c => ({ ...c }));
    return [...RESOURCES, ...custom] as any[];
  });

  const filtered = $derived.by(() => {
    let r = allItems.filter((x: any) => x.type !== 'sop');
    if (typeFilter !== 'all') r = r.filter((x: any) => x.type === typeFilter);
    if (stageFilter !== 'all') r = r.filter((x: any) => x.stage === 'all' || x.stage === stageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x: any) =>
        x.title.toLowerCase().includes(q) ||
        x.desc.toLowerCase().includes(q) ||
        (x.tags || []).some((t: string) => t.toLowerCase().includes(q)) ||
        (x.category || '').toLowerCase().includes(q) ||
        (x.platform || '').toLowerCase().includes(q)
      );
    }
    return r;
  });

  const filteredSOPs = $derived.by(() => {
    if (!search.trim()) return SOPS;
    const q = search.toLowerCase();
    return SOPS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.stage.toLowerCase().includes(q) ||
      s.steps.some(st => st.title.toLowerCase().includes(q))
    );
  });

  const savedItems = $derived.by(() => {
    const all: any[] = [...RESOURCES, ...SOPS, ...store.launchpadCustom];
    return all.filter(x => store.launchpadBookmarks.includes(x.id));
  });

  // ── Save / bookmark ───────────────────────────────────────────────────────
  function toggleSave(id: string) {
    if (store.launchpadBookmarks.includes(id)) {
      store.launchpadBookmarks = store.launchpadBookmarks.filter(b => b !== id);
    } else {
      store.launchpadBookmarks = [...store.launchpadBookmarks, id];
    }
    store.saveLaunchpad().catch(() => {});
  }

  function isSaved(id: string) {
    return store.launchpadBookmarks.includes(id);
  }

  // ── Save to Notes ─────────────────────────────────────────────────────────
  function saveToNotes(title: string, body: string) {
    const note = {
      id: nanoid(), title, body,
      tags: ['startup'],
      createdAt: Date.now(), updatedAt: Date.now(),
      pinned: false, archived: false, audioIds: [],
    };
    store.notes = [note, ...store.notes];
    store.saveNotes().catch(() => {});
    showToast(`Saved to Notes with #startup tag`);
  }

  function resourceToNoteBody(r: any): string {
    return `**${r.title}**\n\n${r.desc}\n\n**Type:** ${r.type}  \n**Platform:** ${r.platform}  \n**Category:** ${r.category}  \n**Stage:** ${r.stage}  \n${r.url ? `**Link:** [${r.url}](${r.url})` : ''}${r.tags?.length ? `\n\n**Tags:** ${r.tags.join(', ')}` : ''}`;
  }

  function sopToNoteBody(sop: SOP): string {
    return `# ${sop.title}\n\n${sop.desc}\n\n**Stage:** ${sop.stage} · **Read time:** ${sop.readTime}\n\n---\n\n${sop.steps.map(s => `## Step ${s.n}: ${s.title}\n\n${s.detail}`).join('\n\n')}`;
  }

  function gpsConvoToNoteBody(): string {
    return `# Enzo Founder GPS Session\n\n${gpsMessages.map(m => m.role === 'user' ? `**You:** ${m.text}` : `**Enzo:** ${m.text}`).join('\n\n---\n\n')}`;
  }

  // ── Enzo GPS ──────────────────────────────────────────────────────────────
  async function sendGPS() {
    const text = gpsInput.trim();
    if (!text || gpsStreaming) return;
    gpsInput = '';
    gpsMessages = [...gpsMessages, { role: 'user', text, ts: Date.now() }];
    const idx = gpsMessages.length;
    gpsMessages = [...gpsMessages, { role: 'enzo', text: '', ts: Date.now() }];
    gpsStreaming = true;
    gpsAbort = new AbortController();
    try {
      await streamFounderGPS(text, chunk => {
        gpsMessages[idx] = { ...gpsMessages[idx], text: gpsMessages[idx].text + chunk };
        gpsMessages = [...gpsMessages];
        if (gpsContainer) gpsContainer.scrollTop = gpsContainer.scrollHeight;
      }, gpsAbort.signal);
    } catch { /* aborted */ }
    gpsStreaming = false;
  }

  function stopGPS() {
    gpsAbort?.abort();
    gpsStreaming = false;
  }

  // ── News ──────────────────────────────────────────────────────────────────
  const NEWS_FEEDS = [
    { name:'STAT News', url:'https://www.statnews.com/feed/', color:'#e63946' },
    { name:'FierceBiotech', url:'https://www.fiercebiotech.com/rss/xml', color:'#1d7ac5' },
    { name:'Endpoints News', url:'https://endpts.com/feed/', color:'#2d6a4f' },
    { name:'BioPharma Dive', url:'https://www.biopharmadive.com/feeds/news/', color:'#7b2d8b' },
  ];

  async function fetchNews() {
    if (newsLoading) return;
    newsLoading = true;
    newsError = '';
    try {
      const results = await Promise.allSettled(
        NEWS_FEEDS.map(async feed => {
          const r = await fetch(
            `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=6`,
            { signal: AbortSignal.timeout(8000) }
          );
          const data = await r.json();
          return (data.items || []).map((item: any) => ({
            title: item.title?.replace(/&amp;/g,'&').replace(/&#039;/g,"'"),
            url: item.link,
            desc: (item.description || item.content || '').replace(/<[^>]+>/g,'').slice(0, 200).trim(),
            pubDate: item.pubDate,
            source: feed.name,
            sourceColor: feed.color,
          }));
        })
      );
      const all: NewsItem[] = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => (r as PromiseFulfilledResult<NewsItem[]>).value);
      all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      newsItems = all;
    } catch {
      newsError = 'Could not load news feeds. Check your connection.';
    }
    newsLoading = false;
  }

  $effect(() => {
    if (activeTab === 'news' && newsItems.length === 0 && !newsLoading) fetchNews();
  });

  // ── Add custom resource ───────────────────────────────────────────────────
  function addCustom() {
    if (!addTitle.trim() || !addUrl.trim()) return;
    const r: LaunchpadCustomResource = {
      id: nanoid(), type: addType, title: addTitle.trim(),
      desc: addDesc.trim(), url: addUrl.trim(),
      platform:'Custom', category:'Custom', tags:[], stage:'all',
      addedAt: Date.now(),
    };
    store.launchpadCustom = [r, ...store.launchpadCustom];
    store.launchpadBookmarks = [...store.launchpadBookmarks, r.id];
    store.saveLaunchpad().catch(() => {});
    addTitle = ''; addUrl = ''; addDesc = ''; showAdd = false;
    showToast('Resource added and saved');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const TYPE_ICONS: Record<string, string> = {
    podcast:    'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
    video:      'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z',
    playlist:   'M4 6h16M4 10h16M4 14h6',
    community:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',
    tool:       'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    newsletter: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    sop:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    custom:     'M12 4v16m8-8H4',
  };

  const TYPE_COLORS: Record<string, string> = {
    podcast: 'var(--enzo)', video: 'var(--ac)', playlist: 'var(--yw)',
    community: 'var(--gn)', tool: 'var(--pu)', newsletter: 'var(--rd)',
    sop: 'var(--mu)', custom: 'var(--ac)',
  };

  const STAGE_LABELS: Record<string, string> = {
    'all': 'All Stages', 'pre-formation': 'Pre-Formation',
    'early-stage': 'Early Stage', 'growth': 'Growth',
  };

  function relDate(d: string): string {
    const ms = Date.now() - new Date(d).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<!-- ─────────────────────────────────────────────────────────────────────── -->
<div class="lp">

  <!-- Header banner -->
  <div class="lp-header">
    <div class="lp-header-inner">
      <div class="lp-title-row">
        <svg class="lp-rocket" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.819m2.562-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
        </svg>
        <div>
          <h1 class="lp-title">Launchpad</h1>
          <p class="lp-subtitle">Startup + Self-Development · Life Science Founder Hub</p>
        </div>
      </div>
      <div class="lp-header-stats">
        <span class="lp-stat">{RESOURCES.length} resources</span>
        <span class="lp-stat">{SOPS.length} playbooks</span>
        <span class="lp-stat">{store.launchpadBookmarks.length} saved</span>
      </div>
    </div>
  </div>

  <!-- Enzo GPS panel -->
  <div class="lp-gps-wrap">
    <button class="lp-gps-toggle" onclick={() => gpsOpen = !gpsOpen}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
      <span>Enzo Founder GPS</span>
      <span class="lp-gps-sub">Tell Enzo where you are → get personalised startup guidance</span>
      <svg class="lp-gps-caret" class:open={gpsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
    </button>

    {#if gpsOpen}
    <div class="lp-gps-body">
      {#if gpsMessages.length > 0}
        <div class="lp-gps-thread" bind:this={gpsContainer}>
          {#each gpsMessages as msg}
            <div class="lp-gps-msg" class:user={msg.role === 'user'} class:enzo={msg.role === 'enzo'}>
              {#if msg.role === 'enzo'}
                <div class="lp-gps-avatar">E</div>
              {/if}
              <div class="lp-gps-bubble">
                <div class="lp-gps-text">{msg.text}{gpsStreaming && msg === gpsMessages[gpsMessages.length-1] && msg.role === 'enzo' ? '▋' : ''}</div>
                {#if msg.role === 'enzo' && msg.text && !gpsStreaming}
                  <button class="lp-gps-savenote" onclick={() => saveToNotes('Enzo GPS · ' + new Date(msg.ts).toLocaleDateString(), msg.text)}>
                    Save to Notes ↗
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        {#if gpsMessages.length > 1}
          <div class="lp-gps-save-convo">
            <button onclick={() => saveToNotes('Enzo GPS Session · ' + new Date().toLocaleDateString(), gpsConvoToNoteBody())}>
              Save full conversation to Notes ↗
            </button>
            <button onclick={() => { gpsMessages = []; }}>Clear</button>
          </div>
        {/if}
      {:else}
        <p class="lp-gps-hint">Describe where you are in your startup journey. Be as specific as you like — Enzo will give you personalised, step-by-step guidance. You can keep the conversation going with follow-up questions.</p>
      {/if}
      <div class="lp-gps-input-row">
        <textarea
          class="lp-gps-input"
          placeholder="e.g. 'I'm a postdoc in oncology at Heidelberg, have unpublished preclinical data on a HGSOC combination therapy, and just had a conversation with my TTO. I don't know what to do next...'"
          bind:value={gpsInput}
          onkeydown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGPS(); } }}
          rows="2"
        ></textarea>
        {#if gpsStreaming}
          <button class="lp-gps-send stop" onclick={stopGPS}>■ Stop</button>
        {:else}
          <button class="lp-gps-send" onclick={sendGPS} disabled={!gpsInput.trim()}>Ask Enzo →</button>
        {/if}
      </div>
    </div>
    {/if}
  </div>

  <!-- Tab bar + search -->
  <div class="lp-controls">
    <div class="lp-tabs">
      {#each [['resources','Resources'], ['sops','Playbooks'], ['news','Live News'], ['saved','Saved']] as [id, label]}
        <button class="lp-tab" class:active={activeTab === id} onclick={() => { activeTab = id as any; search = ''; }}>
          {label}
          {#if id === 'saved' && store.launchpadBookmarks.length > 0}
            <span class="lp-tab-badge">{store.launchpadBookmarks.length}</span>
          {/if}
        </button>
      {/each}
      <button class="lp-tab lp-tab-add" onclick={() => showAdd = !showAdd}>+ Add</button>
    </div>

    {#if activeTab !== 'news'}
      <div class="lp-search-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="lp-search" placeholder="Search resources, tags, categories…" bind:value={search} />
        {#if search}<button class="lp-search-clear" onclick={() => search = ''}>×</button>{/if}
      </div>
    {/if}
  </div>

  <!-- Add custom resource form -->
  {#if showAdd}
    <div class="lp-add-form">
      <div class="lp-add-row">
        <select class="lp-add-select" bind:value={addType}>
          {#each ['podcast','video','playlist','community','tool','newsletter'] as t}
            <option value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
          {/each}
        </select>
        <input class="lp-add-input" placeholder="Title *" bind:value={addTitle} />
        <input class="lp-add-input" placeholder="URL *" bind:value={addUrl} />
      </div>
      <div class="lp-add-row">
        <input class="lp-add-input full" placeholder="Short description" bind:value={addDesc} />
        <button class="lp-add-btn" onclick={addCustom} disabled={!addTitle.trim() || !addUrl.trim()}>Add & Save</button>
        <button class="lp-add-cancel" onclick={() => showAdd = false}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- ── Resources tab ── -->
  {#if activeTab === 'resources'}
    <div class="lp-filters">
      <div class="lp-filter-row">
        {#each [['all','All'],['podcast','Podcasts'],['video','Videos'],['playlist','Playlists'],['community','Communities'],['tool','Tools'],['newsletter','Newsletters']] as [val, label]}
          <button class="lp-chip" class:active={typeFilter === val} onclick={() => typeFilter = val}>{label}</button>
        {/each}
      </div>
      <div class="lp-filter-row">
        {#each [['all','All Stages'],['pre-formation','Pre-Formation'],['early-stage','Early Stage'],['growth','Growth']] as [val, label]}
          <button class="lp-chip stage" class:active={stageFilter === val} onclick={() => stageFilter = val}>{label}</button>
        {/each}
      </div>
    </div>

    {#if filtered.length === 0}
      <div class="lp-empty">No resources match your filters.</div>
    {:else}
      <div class="lp-count">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</div>
      <div class="lp-grid">
        {#each filtered as r (r.id)}
          {@const saved = isSaved(r.id)}
          <div class="lp-card">
            <div class="lp-card-top">
              <div class="lp-card-type" style="color:{TYPE_COLORS[r.type] || 'var(--ac)'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d={TYPE_ICONS[r.type] || TYPE_ICONS.custom}/>
                </svg>
                <span>{r.type}</span>
              </div>
              <div class="lp-card-actions">
                <button class="lp-save-btn" class:saved onclick={() => toggleSave(r.id)} title={saved ? 'Unsave' : 'Save'}>
                  {saved ? '♥' : '♡'}
                </button>
              </div>
            </div>
            <div class="lp-card-title">{r.title}</div>
            <div class="lp-card-platform">{r.platform}</div>
            <div class="lp-card-desc">{r.desc}</div>
            <div class="lp-card-tags">
              {#if r.stage && r.stage !== 'all'}
                <span class="lp-tag stage">{STAGE_LABELS[r.stage] || r.stage}</span>
              {/if}
              {#each (r.tags || []).slice(0, 3) as tag}
                <span class="lp-tag">{tag}</span>
              {/each}
            </div>
            <div class="lp-card-footer">
              <span class="lp-card-cat">{r.category}</span>
              <div class="lp-card-btns">
                <button class="lp-note-btn" onclick={() => saveToNotes(r.title, resourceToNoteBody(r))} title="Save to Notes">↗ Note</button>
                {#if (r as any).url}
                  <a class="lp-open-btn" href={(r as any).url} target="_blank" rel="noopener">Open →</a>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- ── SOPs tab ── -->
  {:else if activeTab === 'sops'}
    {#if selectedSOP}
      <div class="lp-sop-view">
        <div class="lp-sop-view-header">
          <button class="lp-sop-back" onclick={() => { selectedSOP = null; selectedSOPStep = null; }}>← Back to playbooks</button>
          <div class="lp-sop-view-meta">
            <span class="lp-tag stage">{selectedSOP.stage}</span>
            <span class="lp-tag">{selectedSOP.readTime}</span>
          </div>
          <div class="lp-sop-view-actions">
            <button class="lp-save-btn" class:saved={isSaved(selectedSOP.id)} onclick={() => toggleSave(selectedSOP!.id)}>{isSaved(selectedSOP.id) ? '♥ Saved' : '♡ Save'}</button>
            <button class="lp-note-btn" onclick={() => saveToNotes(selectedSOP!.title, sopToNoteBody(selectedSOP!))}>↗ Save whole SOP to Notes</button>
          </div>
        </div>
        <h2 class="lp-sop-view-title">{selectedSOP.title}</h2>
        <p class="lp-sop-view-desc">{selectedSOP.desc}</p>
        <div class="lp-sop-steps">
          {#each selectedSOP.steps as step}
            <div class="lp-sop-step" class:open={selectedSOPStep === step.n} onclick={() => selectedSOPStep = selectedSOPStep === step.n ? null : step.n}>
              <div class="lp-sop-step-header">
                <div class="lp-sop-step-n">{step.n}</div>
                <div class="lp-sop-step-title">{step.title}</div>
                <svg class="lp-sop-step-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              {#if selectedSOPStep === step.n}
                <div class="lp-sop-step-detail">
                  <p>{step.detail}</p>
                  <button class="lp-note-btn sm" onclick={e => { e.stopPropagation(); saveToNotes(`${selectedSOP!.title} · Step ${step.n}: ${step.title}`, step.detail); }}>↗ Save step to Notes</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="lp-sop-grid">
        {#each filteredSOPs as sop}
          <div class="lp-sop-card">
            <div class="lp-sop-card-header">
              <span class="lp-tag stage">{sop.stage}</span>
              <span class="lp-tag">{sop.readTime}</span>
              <button class="lp-save-btn" class:saved={isSaved(sop.id)} onclick={() => toggleSave(sop.id)}>{isSaved(sop.id) ? '♥' : '♡'}</button>
            </div>
            <div class="lp-sop-card-title">{sop.title}</div>
            <div class="lp-sop-card-desc">{sop.desc}</div>
            <div class="lp-sop-card-steps">{sop.steps.length} steps</div>
            <div class="lp-sop-card-footer">
              <button class="lp-open-btn" onclick={() => { selectedSOP = sop; selectedSOPStep = null; }}>Read playbook →</button>
              <button class="lp-note-btn" onclick={() => saveToNotes(sop.title, sopToNoteBody(sop))}>↗ Note</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- ── News tab ── -->
  {:else if activeTab === 'news'}
    <div class="lp-news-header">
      <span class="lp-news-title">Live Biotech & Startup News</span>
      <div class="lp-news-feeds">
        {#each NEWS_FEEDS as f}
          <span class="lp-news-badge" style="background:{f.color}22;color:{f.color}">{f.name}</span>
        {/each}
      </div>
      <button class="lp-refresh-btn" onclick={fetchNews} disabled={newsLoading}>{newsLoading ? 'Loading…' : '↻ Refresh'}</button>
    </div>
    {#if newsError}
      <div class="lp-news-error">{newsError}</div>
    {:else if newsLoading && newsItems.length === 0}
      <div class="lp-news-loading">Loading news feeds…</div>
    {:else if newsItems.length === 0}
      <div class="lp-empty">Click Refresh to load the latest biotech news.</div>
    {:else}
      <div class="lp-news-list">
        {#each newsItems as item}
          <div class="lp-news-item">
            <div class="lp-news-item-meta">
              <span class="lp-news-badge sm" style="background:{item.sourceColor}22;color:{item.sourceColor}">{item.source}</span>
              <span class="lp-news-date">{relDate(item.pubDate)}</span>
            </div>
            <a class="lp-news-item-title" href={item.url} target="_blank" rel="noopener">{item.title}</a>
            {#if item.desc}<p class="lp-news-item-desc">{item.desc}…</p>{/if}
            <div class="lp-news-item-actions">
              <button class="lp-note-btn sm" onclick={() => saveToNotes(item.title, `**Source:** ${item.source}\n**Date:** ${item.pubDate}\n**Link:** [${item.url}](${item.url})\n\n${item.desc}`)}>↗ Save to Notes</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- ── Saved tab ── -->
  {:else if activeTab === 'saved'}
    {#if savedItems.length === 0}
      <div class="lp-empty">Nothing saved yet — hit ♡ on any resource, playbook, or news item.</div>
    {:else}
      <div class="lp-count">{savedItems.length} saved item{savedItems.length !== 1 ? 's' : ''}</div>
      <div class="lp-grid">
        {#each savedItems as r}
          {@const isSOP = 'steps' in r}
          <div class="lp-card">
            <div class="lp-card-top">
              <div class="lp-card-type" style="color:{isSOP ? 'var(--mu)' : (TYPE_COLORS[r.type] || 'var(--ac)')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d={isSOP ? TYPE_ICONS.sop : (TYPE_ICONS[r.type] || TYPE_ICONS.custom)}/>
                </svg>
                <span>{isSOP ? 'playbook' : r.type}</span>
              </div>
              <button class="lp-save-btn saved" onclick={() => toggleSave(r.id)}>♥</button>
            </div>
            <div class="lp-card-title">{r.title}</div>
            {#if !isSOP && (r as any).platform}<div class="lp-card-platform">{(r as any).platform}</div>{/if}
            <div class="lp-card-desc">{r.desc}</div>
            <div class="lp-card-footer">
              <span class="lp-card-cat">{isSOP ? (r as SOP).stage : (r as any).category}</span>
              <div class="lp-card-btns">
                {#if isSOP}
                  <button class="lp-open-btn" onclick={() => { selectedSOP = r as SOP; activeTab = 'sops'; }}>Read →</button>
                  <button class="lp-note-btn" onclick={() => saveToNotes(r.title, sopToNoteBody(r as SOP))}>↗ Note</button>
                {:else}
                  <button class="lp-note-btn" onclick={() => saveToNotes(r.title, resourceToNoteBody(r))}>↗ Note</button>
                  {#if (r as any).url}<a class="lp-open-btn" href={(r as any).url} target="_blank" rel="noopener">Open →</a>{/if}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Toast -->
  {#if toast}
    <div class="lp-toast">{toast}</div>
  {/if}
</div>

<style>
  .lp { display:flex; flex-direction:column; height:100%; overflow-y:auto; background:var(--bg); }

  /* Header */
  .lp-header { background:linear-gradient(135deg, var(--ac-bg) 0%, var(--pu-bg,#1e1b4b22) 100%); border-bottom:1px solid var(--br); padding:1.2rem 1.5rem 1rem; flex-shrink:0; }
  .lp-header-inner { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .lp-title-row { display:flex; align-items:center; gap:.9rem; }
  .lp-rocket { width:2.4rem; height:2.4rem; color:var(--ac); flex-shrink:0; }
  .lp-title { font-size:1.45rem; font-weight:700; color:var(--tx); margin:0; line-height:1.2; }
  .lp-subtitle { font-size:.75rem; color:var(--tx2); margin:.1rem 0 0; }
  .lp-header-stats { display:flex; gap:.6rem; flex-wrap:wrap; }
  .lp-stat { font-size:.72rem; background:var(--sf2); color:var(--tx2); border-radius:99px; padding:.2rem .6rem; }

  /* GPS */
  .lp-gps-wrap { border-bottom:1px solid var(--br); flex-shrink:0; }
  .lp-gps-toggle { width:100%; display:flex; align-items:center; gap:.6rem; padding:.7rem 1.2rem; background:none; border:none; cursor:pointer; color:var(--tx); text-align:left; }
  .lp-gps-toggle svg:first-child { width:1.1rem; height:1.1rem; color:var(--enzo); flex-shrink:0; }
  .lp-gps-toggle > span:first-of-type { font-weight:600; font-size:.88rem; white-space:nowrap; }
  .lp-gps-sub { font-size:.73rem; color:var(--tx2); flex:1; }
  .lp-gps-caret { width:1rem; height:1rem; color:var(--tx3); transition:transform .2s; flex-shrink:0; }
  .lp-gps-caret.open { transform:rotate(180deg); }
  .lp-gps-body { padding:.8rem 1.2rem 1rem; display:flex; flex-direction:column; gap:.6rem; }
  .lp-gps-hint { font-size:.8rem; color:var(--tx2); margin:0; font-style:italic; }
  .lp-gps-thread { display:flex; flex-direction:column; gap:.6rem; max-height:320px; overflow-y:auto; padding:.4rem 0; }
  .lp-gps-msg { display:flex; gap:.5rem; }
  .lp-gps-msg.user { justify-content:flex-end; }
  .lp-gps-avatar { width:1.5rem; height:1.5rem; border-radius:50%; background:var(--enzo); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:700; flex-shrink:0; margin-top:.1rem; }
  .lp-gps-bubble { max-width:85%; }
  .lp-gps-msg.user .lp-gps-bubble { background:var(--ac-bg); border:1px solid var(--ac); border-radius:12px 12px 2px 12px; padding:.5rem .75rem; }
  .lp-gps-msg.enzo .lp-gps-bubble { background:var(--sf2); border-radius:2px 12px 12px 12px; padding:.5rem .75rem; }
  .lp-gps-text { font-size:.82rem; line-height:1.55; color:var(--tx); white-space:pre-wrap; }
  .lp-gps-savenote { display:block; margin-top:.4rem; font-size:.72rem; color:var(--ac); background:none; border:none; cursor:pointer; padding:0; }
  .lp-gps-savenote:hover { text-decoration:underline; }
  .lp-gps-save-convo { display:flex; gap:.5rem; }
  .lp-gps-save-convo button { font-size:.73rem; background:none; border:1px solid var(--br); border-radius:6px; padding:.2rem .5rem; cursor:pointer; color:var(--tx2); }
  .lp-gps-save-convo button:hover { color:var(--tx); }
  .lp-gps-input-row { display:flex; gap:.5rem; align-items:flex-end; }
  .lp-gps-input { flex:1; background:var(--sf); border:1px solid var(--br); border-radius:8px; padding:.5rem .7rem; font-size:.82rem; color:var(--tx); resize:none; font-family:inherit; }
  .lp-gps-input:focus { outline:none; border-color:var(--ac); }
  .lp-gps-send { background:var(--ac); color:#fff; border:none; border-radius:8px; padding:.5rem .9rem; font-size:.82rem; cursor:pointer; white-space:nowrap; }
  .lp-gps-send:disabled { opacity:.4; cursor:default; }
  .lp-gps-send.stop { background:var(--rd); }

  /* Controls */
  .lp-controls { display:flex; align-items:center; gap:.8rem; padding:.6rem 1rem; border-bottom:1px solid var(--br); flex-shrink:0; flex-wrap:wrap; }
  .lp-tabs { display:flex; gap:.2rem; }
  .lp-tab { background:none; border:none; cursor:pointer; font-size:.8rem; color:var(--tx2); padding:.3rem .7rem; border-radius:6px; }
  .lp-tab:hover { background:var(--sf2); color:var(--tx); }
  .lp-tab.active { background:var(--ac-bg); color:var(--ac); font-weight:600; }
  .lp-tab-badge { background:var(--ac); color:#fff; border-radius:99px; font-size:.65rem; padding:.05rem .35rem; margin-left:.2rem; }
  .lp-tab-add { border:1px dashed var(--br); color:var(--ac); }
  .lp-search-row { display:flex; align-items:center; flex:1; min-width:180px; background:var(--sf); border:1px solid var(--br); border-radius:8px; padding:.3rem .6rem; gap:.4rem; }
  .lp-search-row svg { width:.9rem; height:.9rem; color:var(--tx3); flex-shrink:0; }
  .lp-search { flex:1; background:none; border:none; font-size:.82rem; color:var(--tx); outline:none; }
  .lp-search::placeholder { color:var(--tx3); }
  .lp-search-clear { background:none; border:none; cursor:pointer; color:var(--tx3); font-size:1rem; padding:0; line-height:1; }

  /* Add form */
  .lp-add-form { padding:.7rem 1rem; background:var(--sf); border-bottom:1px solid var(--br); display:flex; flex-direction:column; gap:.5rem; flex-shrink:0; }
  .lp-add-row { display:flex; gap:.5rem; flex-wrap:wrap; }
  .lp-add-select { background:var(--bg); border:1px solid var(--br); border-radius:6px; color:var(--tx); font-size:.8rem; padding:.3rem .5rem; }
  .lp-add-input { flex:1; min-width:120px; background:var(--bg); border:1px solid var(--br); border-radius:6px; color:var(--tx); font-size:.8rem; padding:.3rem .6rem; }
  .lp-add-input.full { min-width:200px; }
  .lp-add-btn { background:var(--ac); color:#fff; border:none; border-radius:6px; font-size:.8rem; padding:.3rem .7rem; cursor:pointer; }
  .lp-add-btn:disabled { opacity:.4; cursor:default; }
  .lp-add-cancel { background:none; border:1px solid var(--br); border-radius:6px; font-size:.8rem; padding:.3rem .6rem; cursor:pointer; color:var(--tx2); }

  /* Filters */
  .lp-filters { display:flex; flex-direction:column; gap:.3rem; padding:.6rem 1rem; border-bottom:1px solid var(--br); flex-shrink:0; }
  .lp-filter-row { display:flex; gap:.3rem; flex-wrap:wrap; }
  .lp-chip { background:var(--sf); border:1px solid var(--br); border-radius:99px; font-size:.75rem; padding:.2rem .65rem; cursor:pointer; color:var(--tx2); }
  .lp-chip:hover { color:var(--tx); }
  .lp-chip.active { background:var(--ac-bg); border-color:var(--ac); color:var(--ac); font-weight:600; }
  .lp-chip.stage.active { background:var(--gn-bg,#0d3321); border-color:var(--gn); color:var(--gn); }

  .lp-count { font-size:.75rem; color:var(--tx3); padding:.4rem 1rem 0; }
  .lp-empty { padding:2rem 1rem; text-align:center; color:var(--tx3); font-size:.85rem; }

  /* Resource grid */
  .lp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:.8rem; padding:.8rem 1rem 2rem; }
  .lp-card { background:var(--sf); border:1px solid var(--br); border-radius:10px; padding:.85rem; display:flex; flex-direction:column; gap:.4rem; transition:border-color .15s; }
  .lp-card:hover { border-color:var(--ac); }
  .lp-card-top { display:flex; align-items:center; justify-content:space-between; }
  .lp-card-type { display:flex; align-items:center; gap:.3rem; font-size:.7rem; text-transform:capitalize; font-weight:600; }
  .lp-card-type svg { width:.9rem; height:.9rem; }
  .lp-card-actions { display:flex; gap:.3rem; }
  .lp-save-btn { background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--tx3); line-height:1; padding:.1rem; }
  .lp-save-btn.saved { color:var(--rd); }
  .lp-card-title { font-weight:600; font-size:.88rem; color:var(--tx); line-height:1.3; }
  .lp-card-platform { font-size:.7rem; color:var(--tx3); }
  .lp-card-desc { font-size:.78rem; color:var(--tx2); line-height:1.45; flex:1; }
  .lp-card-tags { display:flex; gap:.3rem; flex-wrap:wrap; }
  .lp-tag { font-size:.67rem; background:var(--sf2); border-radius:4px; padding:.1rem .35rem; color:var(--tx3); }
  .lp-tag.stage { background:var(--gn-bg,#0d3321); color:var(--gn); }
  .lp-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:.2rem; }
  .lp-card-cat { font-size:.7rem; color:var(--tx3); }
  .lp-card-btns { display:flex; gap:.4rem; align-items:center; }
  .lp-note-btn { background:none; border:1px solid var(--br); border-radius:5px; font-size:.72rem; padding:.15rem .4rem; cursor:pointer; color:var(--tx2); white-space:nowrap; }
  .lp-note-btn:hover { color:var(--ac); border-color:var(--ac); }
  .lp-note-btn.sm { font-size:.7rem; padding:.1rem .35rem; }
  .lp-open-btn { background:var(--ac-bg); color:var(--ac); border:1px solid var(--ac); border-radius:5px; font-size:.72rem; padding:.15rem .45rem; cursor:pointer; text-decoration:none; white-space:nowrap; }
  .lp-open-btn:hover { background:var(--ac); color:#fff; }

  /* SOPs */
  .lp-sop-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:.8rem; padding:.8rem 1rem 2rem; }
  .lp-sop-card { background:var(--sf); border:1px solid var(--br); border-radius:10px; padding:.9rem; display:flex; flex-direction:column; gap:.4rem; }
  .lp-sop-card:hover { border-color:var(--ac); }
  .lp-sop-card-header { display:flex; gap:.4rem; align-items:center; }
  .lp-sop-card-title { font-weight:600; font-size:.9rem; color:var(--tx); line-height:1.3; }
  .lp-sop-card-desc { font-size:.78rem; color:var(--tx2); line-height:1.45; flex:1; }
  .lp-sop-card-steps { font-size:.72rem; color:var(--tx3); }
  .lp-sop-card-footer { display:flex; gap:.4rem; margin-top:.2rem; }

  .lp-sop-view { padding:1rem; display:flex; flex-direction:column; gap:.8rem; max-width:760px; }
  .lp-sop-view-header { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
  .lp-sop-back { background:none; border:1px solid var(--br); border-radius:6px; font-size:.78rem; padding:.25rem .6rem; cursor:pointer; color:var(--tx2); }
  .lp-sop-back:hover { color:var(--ac); border-color:var(--ac); }
  .lp-sop-view-meta { display:flex; gap:.4rem; }
  .lp-sop-view-actions { display:flex; gap:.4rem; margin-left:auto; }
  .lp-sop-view-title { font-size:1.25rem; font-weight:700; color:var(--tx); margin:0; }
  .lp-sop-view-desc { font-size:.85rem; color:var(--tx2); margin:0; line-height:1.5; }
  .lp-sop-steps { display:flex; flex-direction:column; gap:.4rem; }
  .lp-sop-step { background:var(--sf); border:1px solid var(--br); border-radius:8px; cursor:pointer; overflow:hidden; }
  .lp-sop-step:hover { border-color:var(--ac); }
  .lp-sop-step.open { border-color:var(--ac); }
  .lp-sop-step-header { display:flex; align-items:center; gap:.7rem; padding:.65rem .9rem; }
  .lp-sop-step-n { width:1.6rem; height:1.6rem; border-radius:50%; background:var(--ac-bg); color:var(--ac); font-size:.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .lp-sop-step.open .lp-sop-step-n { background:var(--ac); color:#fff; }
  .lp-sop-step-title { flex:1; font-size:.85rem; font-weight:600; color:var(--tx); }
  .lp-sop-step-caret { width:.9rem; height:.9rem; color:var(--tx3); transition:transform .15s; flex-shrink:0; }
  .lp-sop-step.open .lp-sop-step-caret { transform:rotate(180deg); }
  .lp-sop-step-detail { padding:.5rem .9rem .75rem 3.2rem; border-top:1px solid var(--br); }
  .lp-sop-step-detail p { font-size:.82rem; color:var(--tx2); line-height:1.6; margin:0 0 .5rem; }

  /* News */
  .lp-news-header { display:flex; align-items:center; gap:.6rem; padding:.7rem 1rem; border-bottom:1px solid var(--br); flex-wrap:wrap; flex-shrink:0; }
  .lp-news-title { font-weight:600; font-size:.88rem; color:var(--tx); }
  .lp-news-feeds { display:flex; gap:.3rem; flex-wrap:wrap; }
  .lp-news-badge { font-size:.68rem; border-radius:4px; padding:.15rem .4rem; font-weight:600; }
  .lp-news-badge.sm { font-size:.67rem; }
  .lp-refresh-btn { margin-left:auto; background:var(--sf); border:1px solid var(--br); border-radius:6px; font-size:.78rem; padding:.25rem .6rem; cursor:pointer; color:var(--tx2); }
  .lp-refresh-btn:disabled { opacity:.4; cursor:default; }
  .lp-news-loading, .lp-news-error { padding:1.5rem 1rem; text-align:center; font-size:.85rem; color:var(--tx3); }
  .lp-news-list { display:flex; flex-direction:column; gap:0; }
  .lp-news-item { padding:.8rem 1rem; border-bottom:1px solid var(--br); display:flex; flex-direction:column; gap:.3rem; }
  .lp-news-item:hover { background:var(--sf); }
  .lp-news-item-meta { display:flex; align-items:center; gap:.5rem; }
  .lp-news-date { font-size:.7rem; color:var(--tx3); }
  .lp-news-item-title { font-size:.85rem; font-weight:600; color:var(--ac); text-decoration:none; line-height:1.35; }
  .lp-news-item-title:hover { text-decoration:underline; }
  .lp-news-item-desc { font-size:.77rem; color:var(--tx2); margin:0; line-height:1.45; }
  .lp-news-item-actions { display:flex; gap:.4rem; }

  /* Toast */
  .lp-toast { position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%); background:var(--tx); color:var(--bg); border-radius:8px; padding:.5rem 1rem; font-size:.8rem; z-index:9999; pointer-events:none; animation:lp-fadein .15s ease; }
  @keyframes lp-fadein { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
</style>
