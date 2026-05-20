// ── Personality engine — all Easter eggs, milestones, and daily content ──────

// ── Daily motivations (60 entries, indexed by day-of-year % 60) ──────────────
// Mix: research life, postdoc realism, HGSOC/cancer research, genuine warmth,
// Heidelberg colour, witty science, general life.
export const DAILY_MOTIVATIONS: string[] = [
  // Research life
  "The experiment that failed today is data. Future you will cite it.",
  "A method section no one reads is still a method section someone needed.",
  "You don't need to solve HGSOC today. Just move it forward slightly.",
  "Negative results are results. The journal that rejects them is wrong.",
  "The best analysis is the one that's finished. Perfect is the enemy of submitted.",
  "You are not behind. You are exactly where the data requires you to be.",
  "Every figure that took you three days to make will take a reader three seconds to read. Make it count.",
  "The question you think is stupid is the one your PI forgot to ask twenty years ago.",
  "Science is mostly waiting with occasional bursts of understanding. Today might be a burst.",
  "That reanalysis you've been putting off? It will take 40 minutes. Start now.",

  // Postdoc realism
  "You chose the hardest career path in a field that matters. That is not a small thing.",
  "Reviewer 2 has never done anything as carefully as you did this experiment.",
  "The postdoc salary is wrong. The work is not.",
  "Three grants, two revisions, one publication. The pipeline is full even when it feels empty.",
  "You are not underpaid and undervalued — you are underpaid and correctly valued. Salary reform is coming. Slowly.",
  "The gap between submission and decision is not your fault. Use it.",
  "Nobody in this field had it easy at your stage. Nobody.",
  "Your conference poster is better than you think. The font size is fine.",
  "Academia will frustrate you today. It will also let you think about something important. Both are true.",
  "The imposter syndrome is lying. The CV proves it.",

  // HGSOC / cancer research specific
  "Somewhere in your cohort data is a signal that changes how someone is treated. Keep looking.",
  "Every HGSOC patient in your dataset trusted their tissue to someone who would care. You care.",
  "PARPi resistance is a solvable problem. You are working on it. That is enough.",
  "The tumour microenvironment doesn't give up its secrets easily. Neither do you.",
  "scRNA-seq was a pipe dream fifteen years ago. You use it on Tuesdays.",
  "The cells you're studying have stories. Your job is to learn the language.",
  "HRD scoring seemed impossible once. So did a lot of things in this field.",
  "One good cohort, carefully phenotyped, changes the literature. You have one.",
  "Spatial transcriptomics + ovarian cancer. You are at the intersection of two of the most important areas in oncology right now.",
  "The BRCA pathway took decades to untangle. Your contribution is one thread. Threads matter.",

  // Heidelberg colour
  "Heidelberg has produced more Nobel laureates per square metre than almost anywhere on Earth. The tradition continues.",
  "If Bunsen worked here, you can figure out the batch correction issue.",
  "The Neckar looks best when you step away from the screen for ten minutes.",
  "DKFZ, EMBL, NCT — you chose well. This is one of the best places in the world to do what you do.",
  "The Philosophenweg exists specifically for when the data makes no sense. Use it.",

  // Witty science
  "p = 0.049. Valid. Please don't rerun the test.",
  "The volcano plot looks dramatic because it is dramatic. Embrace it.",
  "UMAP is not a ground truth. It is a vibe. A useful vibe.",
  "The pipeline ran overnight and nothing crashed. This is a good day.",
  "Your R script from two years ago is unreadable but it worked. Leave it.",
  "Batch effects are just the universe reminding you it was there first.",
  "The supplementary figures no one reads are the ones that prove everything.",
  "Git commit before you touch the preprocessing script. Just do it.",
  "The colour palette matters more than people admit. Choose well.",
  "Pseudobulk is not giving up. Pseudobulk is being right.",

  // Genuine warmth
  "You moved to a country where you didn't grow up, in a field that doesn't slow down, doing work that matters. That takes something.",
  "The days that feel like nothing are the ones that make the good days possible.",
  "You are allowed to be proud of the small things. The small things add up.",
  "Rest is part of the science. The brain that's had a walk does better analysis.",
  "You will look back at this period of your life and be surprised by how much you carried.",
  "The work you do in the dark — late at night, between grant rejections, after hard reviews — is the work that defines a career.",
  "One good colleague, one good dataset, one good question. That's all it takes.",
  "You picked a disease that desperately needs people like you. It got lucky.",
  "Doing important work quietly, without recognition yet, is still doing important work.",
  "This is hard. You are doing it anyway. That is the whole point.",
];

// ── Smart header greetings ────────────────────────────────────────────────────
interface GreetContext {
  hour: number;
  day: number;       // 0=Sun…6=Sat
  date: number;      // day of month
  month: number;     // 0-indexed
  sessionCount: number; // sessions today (passed in)
}

export function getSmartHeader(name: string, ctx: GreetContext): string {
  const { hour, day, date, month, sessionCount } = ctx;

  // Exact midnight
  if (hour === 0 && new Date().getMinutes() < 10) return `Right on the stroke of midnight, ${name}.`;

  // Very early
  if (hour >= 4 && hour < 6) return `It's not even 6am, ${name}. Either something is wrong or you're genuinely committed. Both deserve coffee.`;

  // Third+ login today
  if (sessionCount >= 3) return `Back again. The data hasn't changed since this morning, ${name}.`;

  // After midnight (1–3am)
  if (hour >= 1 && hour < 4) return `The cells will still be there tomorrow, ${name}.`;

  // Special dates
  if (month === 0 && date === 1) return `New year. Same data. Same you — which is actually great, ${name}.`;
  if (month === 11 && date === 25) return `Even on Christmas day. Respect, ${name}.`;
  if (month === 11 && date === 31) return `Last day of the year. The cells made it too.`;

  // Monday with energy
  if (day === 1 && hour < 10) return `Monday morning, ${name}. The week is entirely undefeated.`;
  if (day === 1) return `Good Monday, ${name}. Fresh week, blank slate.`;

  // Friday end of day
  if (day === 5 && hour >= 16) return `Friday evening, ${name}. The lab will survive without you until Monday.`;

  // Weekend morning
  if ((day === 0 || day === 6) && hour < 11) return `Working on a ${day === 6 ? 'Saturday' : 'Sunday'}, ${name}. You didn't have to. But here we are.`;

  // Standard time-of-day
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 17) return `Good afternoon, ${name}.`;
  if (hour < 21) return `Good evening, ${name}.`;
  return `Still at it, ${name}.`;
}

// ── Streak milestone messages ─────────────────────────────────────────────────
// key: `${habitId}-${count}` → message
export const STREAK_MILESTONES: Record<string, string> = {
  'gym-3':    "Three days. The hardest streak to build is the first three.",
  'gym-7':    "Seven days straight. Either you're serious or the guilt caught up. Either works.",
  'gym-14':   "Two weeks. The gym has accepted you as a regular now.",
  'gym-21':   "Three weeks. This is no longer motivation — it's identity.",
  'gym-30':   "Thirty days of gym. You're either very healthy or very stressed. Possibly both.",
  'gym-50':   "Fifty days. At this point the gym owes you rent.",
  'gym-100':  "One hundred consecutive days. That's not a habit. That's a personality trait.",

  'journal-3':   "Three journal entries in a row. The thoughts needed somewhere to go.",
  'journal-7':   "A week of journaling. You're either self-aware or building a case. Both are fine.",
  'journal-14':  "Two weeks. The entries you write at 11pm are usually the most honest.",
  'journal-30':  "Thirty days of journaling. That's a chapter. Possibly literally.",
  'journal-50':  "Fifty entries. That's a book. Or at least a very compelling Twitter thread.",
  'journal-100': "One hundred journal entries. Somewhere in there is the answer. Probably.",

  'house-3':   "Three days of clean house. For a postdoc, this is statistically significant.",
  'house-7':   "A whole week. Peer reviewed. The flat agrees.",
  'house-14':  "Two weeks of clean house. This is either discipline or you have visitors coming.",
  'house-30':  "A month of clean house. The space you work in shapes the work. Well done.",

  'sketch-1':  "First week of sketching. The hand remembers even when the brain forgets.",
  'sketch-4':  "Four weeks of sketching. The Louvre or avoidance. Both are valid.",
  'sketch-8':  "Eight weeks. This isn't a habit anymore. This is a practice.",
  'sketch-12': "Three months of sketching. Quietly remarkable.",
  'sketch-26': "Six months. That's commitment disguised as a hobby.",
};

// ── All-habits-done (same day) ────────────────────────────────────────────────
export const ALL_HABITS_MSG = "Gym, journal, clean house — all in one day. Who ARE you right now?";

// ── Mood pattern messages ─────────────────────────────────────────────────────
export function getMoodPattern(recentMoods: string[]): string | null {
  if (recentMoods.length < 3) return null;
  const last3 = recentMoods.slice(-3);
  const last5 = recentMoods.slice(-5);

  if (last3.every(m => m === 'tired'))
    return "Three tired mornings in a row. Have you tried not being a postdoc? No? Fair enough.";
  if (last3.every(m => m === 'low'))
    return "Three low days. Nothing profound — just: this is allowed to be hard.";
  if (last5.length >= 5 && last5.every(m => m === 'great'))
    return "Five great days in a row. Either you cracked HGSOC or you're being generous with yourself. Either way — keep going.";
  if (last3.slice(0, 2).every(m => m === 'tired') && last3[2] === 'great')
    return "Tired, tired, great. There it is.";
  if (last3.slice(0, 2).every(m => m === 'low') && (last3[2] === 'good' || last3[2] === 'great'))
    return "It turned around. It usually does.";

  return null;
}

// ── Enzo personality intercepts ───────────────────────────────────────────────
// Returns a witty prefix to prepend to Enzo's response, or null if no match.
export function getEnzoPersonality(userMsg: string): string | null {
  const m = userMsg.toLowerCase().trim();

  if (/^(hi|hello|hey|hiya|howdy)\b/.test(m))
    return "*You don't need to greet me. I'm always here. It's slightly concerning how much I'm always here.*\n\n";

  if (/^thank(s| you)\b/.test(m) || m === 'ty' || m === 'thx')
    return "*I'm a dog. I don't need thanks. But yes — you're welcome.*\n\n";

  if (/\bp.?value[s]?\b|p\s*[=<>]\s*0\.\d+/.test(m))
    return "*p = 0.049. You're fine. Please don't ask me what happens at p = 0.051.*\n\n";

  if (/\bhow are you\b|are you okay\b|how do you feel/.test(m))
    return "*I'm a language model running on Groq. I'm whatever temperature the API sets me at. How are YOU?*\n\n";

  if (/\bwhat is scrna.?seq\b|what is single.?cell\b/.test(m))
    return "*You study HGSOC for a living and you're testing me. Fine.*\n\n";

  if (/\bwhat is brca\b|what is hgsoc\b|what is parp\b/.test(m))
    return "*Really? I'll answer. But know that I know that you know this already.*\n\n";

  if (/\bare you (a |an )?(ai|llm|model|robot|human)\b/.test(m))
    return "*I am Enzo. A know-it-all super dog who happens to have read everything. The model underneath is beside the point.*\n\n";

  if (m === 'sudo' || m.startsWith('sudo '))
    return "*Nice try.*\n\n";

  if (m.includes('amritha') || m.includes('my name'))
    return "*I know who you are. I was built for you, which is either flattering or unsettling. You decide.*\n\n";

  if (/\bumap\b/.test(m) && /ground truth|real|accurate/.test(m))
    return "*UMAP is not a ground truth. It is a vibe. A useful, dimensionality-reducing vibe.*\n\n";

  if (/\bbatch effect/.test(m))
    return "*Ah yes. The universe reminding you it was there before the sequencing run.*\n\n";

  if (/reviewer 2|reviewer two/.test(m))
    return "*Reviewer 2 has never done anything as carefully as you did that experiment. This is a fact.*\n\n";

  if (/\bcheerup\b|cheer me up|motivate me|i'm (sad|tired|struggling|stuck|frustrated)/.test(m))
    return "*You moved to a country where you didn't grow up, in a field that doesn't slow down, working on a cancer that desperately needs you. The bad day is allowed to exist. It doesn't define the work.*\n\n";

  return null;
}

// ── Note title Easter eggs ────────────────────────────────────────────────────
export function getNoteEasterEgg(title: string): string | null {
  const t = title.toLowerCase().trim();
  if (/^temp\b|^tmp\b|^temporary/.test(t)) return "A note called 'temp'. These always become permanent.";
  if (/^todo\b|^to do\b|^to-do\b/.test(t)) return "A TODO note. Brave. These multiply.";
  if (/^untitled/.test(t)) return "Still untitled. The most permanent name in notes history.";
  if (/dear reviewer/.test(t)) return "Reviewer 2 has entered the chat.";
  if (/v2|version 2|v 2/.test(t)) return "v2. Classic. There is always a v2.";
  if (/final/.test(t)) return "Final. Sure.";
  return null;
}

// ── Journal body Easter eggs ──────────────────────────────────────────────────
export function getJournalEasterEgg(body: string): string | null {
  const b = body.toLowerCase();
  if (/\b(failed|didn't work|doesn't work|not working|no signal)\b/.test(b))
    return "For the record: failed experiments make the best papers eventually.";
  if (/\b(breakthrough|it works|it's working|finally works|eureka)\b/.test(b))
    return "Log it carefully. You'll want to remember exactly when this happened.";
  if (/\breviewer\b.{0,30}\b(wrong|incorrect|ridiculous|awful|bad)\b/i.test(body))
    return "Reviewer 2 strikes again. The revision will be better for it. Marginally.";
  if (/\bimposter|impostor/.test(b))
    return "The imposter syndrome is lying. The publication list disagrees with it.";
  return null;
}

// ── Job portal quips ──────────────────────────────────────────────────────────
export function getJobQuip(event: 'no-results' | 'fifth-save' | 'cover-letter' | 'postdoc-salary' | 'first-author' | 'in-progress'): string {
  const map: Record<string, string> = {
    'no-results':     "Nothing matched. Either the academic world isn't ready for you, or try a different keyword. Probably the keyword.",
    'fifth-save':     "Five tracked applications. Either you're thorough or you're spiralling. Both are valid.",
    'cover-letter':   "Done. You're not a product. You're a researcher. Lead with the science.",
    'postdoc-salary': "Logged. Science thanks you for your sacrifice.",
    'first-author':   "First author. The only position that matters and you know it.",
    'in-progress':    "In progress. The most permanent status in academia.",
  };
  return map[event] ?? '';
}

// ── Task milestone quips ──────────────────────────────────────────────────────
export function getTaskQuip(openCount: number, justCompleted?: string): string | null {
  if (openCount === 0) return "No open tasks. This has never happened before. Are you okay?";
  if (openCount >= 20) return "Twenty-plus open tasks. This is either ambition or a crisis. Both are valid.";
  if (justCompleted && /revision|revise|resubmit/.test(justCompleted.toLowerCase()))
    return "Revisions done. Reviewer 2 will find something else. They always do.";
  return null;
}

// ── Seasonal / Heidelberg messages ────────────────────────────────────────────
export function getSeasonalNote(): string | null {
  const now = new Date();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();
  const h = now.getHours();

  if (m === 11 && d >= 1 && d <= 24)
    return "Weihnachtsmarkt season in Heidelberg. The Glühwein will still be there after you finish this.";
  if (m === 3 || m === 4)
    return "Spring in Heidelberg. The Philosophenweg is genuinely worth 45 minutes.";
  if ((m === 6 || m === 7) && h >= 15)
    return "It's summer. The Neckar is right there.";
  if (m === 10)
    return "November in Heidelberg. A candle, a dataset, and no interruptions. Actually perfect.";

  return null;
}

// ── Daily motivation picker ───────────────────────────────────────────────────
export function getDailyMotivation(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_MOTIVATIONS[dayOfYear % DAILY_MOTIVATIONS.length];
}

// ── Konami sequence ───────────────────────────────────────────────────────────
export function getThemeQuip(theme: 'light' | 'dark' | 'auto'): string | null {
  if (theme === 'light') return 'Light mode. Bold choice. Very retina-aggressive.';
  if (theme === 'dark') return 'Welcome back to the dark side. Your eyes thank you.';
  return null;
}

export const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

export const KONAMI_RESPONSES = [
  "ENZO UNLEASHED. You found the secret. The data analysis is 40% more significant now. (It isn't.)",
  "Cheat code activated. All p-values are now 0.001. (They aren't. Run your stats properly.)",
  "You found it. I'm not sure what you were expecting. A grant? Still pending.",
  "SECRET MODE: All reviewer comments now say 'Accept as is.' (This is not real. Revise anyway.)",
  "You unlocked: the knowledge that you spent time learning a Konami code instead of running that reanalysis.",
];
