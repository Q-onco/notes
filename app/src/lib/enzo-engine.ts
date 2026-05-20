// ── Enzo virtual-pet state engine ────────────────────────────────────────────
// Dual-timezone aware (Asia/Kolkata + Europe/Berlin checked simultaneously).
// Driven by real app activity — no LLM calls, pure computation.

export interface StoreData {
  tasks: Array<{ done: boolean; dueDate?: number }>;
  journal: Array<{ date: string }>;
  notes: Array<{ updatedAt: number }>;
  chatSessions: Array<{ date: string; messages: unknown[] }>;
  sessionDates: string[];
}

export interface EnzoSnapshot {
  tasksDue: number;
  tasksOverdue: number;
  journaledToday: boolean;
  journalStreak: number;
  notesThisWeek: number;
  chatCount7d: number;
  chatTodayCount: number;
  loginStreak: number;
  daysSinceLastLogin: number;
  istHour: number;
  cetHour: number;
  istDay: number;
  cetDay: number;
}

export interface EnzoState {
  archetype: string;
  emotion: string;
  visual: 'bright' | 'neutral' | 'sleepy' | 'worried' | 'sad';
  phrase: string;
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

function tzHour(tz: string): number {
  const s = new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date());
  return parseInt(s, 10) % 24;
}

function tzDay(tz: string): number {
  const d = new Date();
  const ws = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: tz }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(ws);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildEnzoSnapshot(d: StoreData): EnzoSnapshot {
  const now = Date.now();
  const todayKey = isoDate(new Date());
  const weekAgo = now - 7 * 86_400_000;

  const tasksDue = d.tasks.filter(t => !t.done).length;
  const tasksOverdue = d.tasks.filter(t => !t.done && !!t.dueDate && t.dueDate < now).length;

  const journaledToday = d.journal.some(j => j.date === todayKey);
  let journalStreak = 0;
  const jd = new Date();
  for (let i = 0; i < 30; i++) {
    if (d.journal.some(j => j.date === isoDate(jd))) { journalStreak++; jd.setDate(jd.getDate() - 1); }
    else break;
  }

  const notesThisWeek = d.notes.filter(n => n.updatedAt > weekAgo).length;

  const chatCount7d = d.chatSessions.filter(s => new Date(s.date).getTime() > weekAgo).length;
  const todaySession = d.chatSessions.find(s => s.date === todayKey);
  const chatTodayCount = todaySession ? (todaySession.messages as unknown[]).length : 0;

  const sorted = [...d.sessionDates].sort().reverse();
  let loginStreak = 0;
  const ld = new Date();
  for (let i = 0; i < 60; i++) {
    if (sorted.includes(isoDate(ld))) { loginStreak++; ld.setDate(ld.getDate() - 1); }
    else break;
  }

  let daysSinceLastLogin = 0;
  if (sorted.length > 0) {
    const last = new Date(sorted[0]);
    const today = new Date(todayKey);
    daysSinceLastLogin = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  }

  return {
    tasksDue, tasksOverdue,
    journaledToday, journalStreak,
    notesThisWeek, chatCount7d, chatTodayCount,
    loginStreak, daysSinceLastLogin,
    istHour: tzHour('Asia/Kolkata'),
    cetHour: tzHour('Europe/Berlin'),
    istDay: tzDay('Asia/Kolkata'),
    cetDay: tzDay('Europe/Berlin'),
  };
}

// ── Archetype definitions ─────────────────────────────────────────────────────

type Visual = 'bright' | 'neutral' | 'sleepy' | 'worried' | 'sad';

interface Archetype {
  name: string;
  visual: Visual;
  phrases: string[];
}

const A: Archetype[] = [

  // ── Time: very late night (both TZ past 23h) ──────────────────────────────
  {
    name: 'midnight', visual: 'sleepy',
    phrases: [
      "Past midnight somewhere. My tail is barely moving. Go sleep.",
      "The data will still be wrong tomorrow morning. Close the laptop.",
      "My paws are heavy. Your eyes must be too.",
      "Past midnight in at least one timezone. Not a productive hour.",
      "Even the TME needs a rest. So do you.",
      "The correlation you're chasing doesn't exist yet. Sleep will help.",
      "No good science comes from a brain running on midnight despair.",
      "Whatever you're trying to fix right now — it can wait.",
      "One more hour becomes two. This is how 3am happens.",
      "The grant isn't due tonight. Your sleep is due tonight.",
      "I've been wagging this tail for hours. Even I need to slow down.",
      "Late-night thoughts feel profound. They almost never are.",
      "Whatever it is, it'll still be there in the morning.",
      "Night-mode brain is unreliable. Day-mode brain does better work.",
      "Shut the laptop. I'll guard it. I'm good at sitting on things.",
      "The figures can wait. The text can wait. Your sleep cannot.",
      "I'm going to rest my head on the keyboard unless you close something.",
      "A tired mind re-reads the same line four times. I've noticed.",
      "The experiment will cooperate more at 9am. I've observed this.",
      "Goodnight, Amritha. Whatever it is — still there in the morning.",
      "You work too hard for a brain that needs sleep. Be kind to it.",
      "Slow tail. Slow thoughts. It's time.",
    ],
  },

  // ── Time: very early (pre-6 CET or pre-7 IST and pre-8 CET) ────────────────
  {
    name: 'groggy', visual: 'sleepy',
    phrases: [
      "Pre-dawn hours. Only those who never slept are awake this early.",
      "Yawning. Not performing a yawn — actually yawning.",
      "The lab doesn't open for hours. The analysis can wait too.",
      "You logged in before the sun. Dedicated or worried? Maybe both.",
      "Pre-6am in Heidelberg. The Neckar doesn't care yet.",
      "I'm doing a very slow tail wag. My tail is as awake as I am.",
      "Coffee first. Everything else second. Non-negotiable.",
      "Early is good. Too early is just midnight in disguise.",
      "I'm blinking slower than usual. Solidarity.",
      "Pre-dawn productivity is a myth believed before fully waking up.",
      "Both timezones say this is unreasonably early. Even IST agrees.",
      "Whatever brought you here this early — I hope it wasn't a self-set alarm.",
      "The morning light in Heidelberg is almost here. Worth waiting for.",
      "Slow morning. Slow tail. This is actually fine.",
      "The ones who crack ovarian cancer will be well-rested. Theory.",
      "If this is a scheduled early start — I respect it. Just yawning first.",
      "Sunrise is worth waiting for. Maybe 40 minutes now.",
      "Good grogginess. The kind before a productive day. I can tell.",
      "My legs feel stiff. I understand the feeling.",
      "You're either very early or very late. Either way, I'm here.",
      "Even I need a moment. One slow stretch, then we work.",
      "The first hour of the day deserves coffee, not crisis.",
    ],
  },

  // ── Absence: 5+ days ──────────────────────────────────────────────────────
  {
    name: 'withdrawn', visual: 'sad',
    phrases: [
      "…you came back.",
      "I've been sitting here for days. The den got very quiet.",
      "My tail wants to wag. It just forgot how for a moment.",
      "I wasn't worried. I was a little worried. I'm a dog.",
      "Five days. I counted. I have a reliable internal clock.",
      "The data didn't stop moving while you were away.",
      "Welcome back. I kept everything exactly where you left it.",
      "I didn't touch the overdue tasks. I can feel them though.",
      "You came back and I'm choosing not to make this awkward.",
      "I missed the sound of the keyboard. I said that.",
      "Days of quiet. Then the door opens. This is my whole world.",
      "I thought about the HGSOC data the whole time you were gone.",
      "Start somewhere small. One task. One note. I'll be right here.",
      "The streak is gone. We build a new one. Right now.",
      "I don't hold grudges. I'm telling you this very deliberately.",
      "Whatever kept you away — I hope it's settled. Back to work.",
      "I have a lot to tell you about that PARPi paper I processed.",
      "You can start anywhere. I'll follow.",
      "The timer reset. So did I. What are we working on?",
      "Back. Good. I kept the den warm.",
    ],
  },

  // ── Absence: 3–4 days ─────────────────────────────────────────────────────
  {
    name: 'sulking', visual: 'sad',
    phrases: [
      "Three days. I'm not sulking. I'm just… sitting differently.",
      "My tail speed has been: slow. For the record.",
      "I was fine. I was completely fine. I barely noticed.",
      "Did something happen? You don't have to tell me. You can also tell me.",
      "I've been practicing sitting very still and not caring. Going fine.",
      "The tasks are still here. The journal is waiting. I've been guarding them.",
      "Back after three days. I have questions but I will not ask them.",
      "I don't guilt-trip. I just have large eyes.",
      "Something in the Heidelberg air, maybe. Or the grant season.",
      "I kept the den warm. It's what I do.",
      "Three days without you and I memorised every pixel on this screen.",
      "The important thing is you're here now. Tail is waking up.",
      "The streak counter is bruised but not broken. Today we start again.",
      "Not judging. Observing. The observational eye is neutral. (The tail less so.)",
      "When researchers get overwhelmed, they disappear. I know this pattern.",
      "Small tail wag. Growing. Getting there.",
      "You're back. Recalibrating from 'quietly bereft' to 'quietly relieved'.",
      "My ears were a little flat. They're coming back up now.",
      "I've been loyal since login. I'll continue from now.",
      "Back. Good. The app missed the sound of typing.",
    ],
  },

  // ── Stress: very high + night ─────────────────────────────────────────────
  {
    name: 'frantic', visual: 'worried',
    phrases: [
      "Late night AND overdue tasks. The worst pairing I know.",
      "Stop. Whatever you're fixing at midnight — fix it tomorrow.",
      "Night-mode brain is unreliable for everything that matters.",
      "I can feel the urgency. Dogs feel these things. Is this actually urgent?",
      "The grant isn't due at 2am. Sleep is due at 2am.",
      "Frantic energy doesn't improve outcomes. Focused energy does.",
      "I'm wagging faster than I should be. We should both calm down.",
      "What's the actual deadline? Hours or days? Panic expands to fill ambiguity.",
      "You've made worse deadlines look fine. This one probably is too.",
      "Late night plus stressed brain equals decision quality I wouldn't publish.",
      "Write a rough version and fix it in the morning. Both steps matter.",
      "I'm slowing my tail down deliberately. As an example.",
      "The last frantic session produced work you later revised. This one will too.",
      "I'm not going anywhere. I'll be here in the morning.",
      "Right now you need: water, sleep, a plan that isn't 'fix everything tonight'.",
      "If you must work: the single most important item only. Then stop.",
      "The data cooperates more at 9am. Pattern recognition.",
      "Come back when the sun is out. Or in three hours. Either.",
      "Tired hands write grant text that tired reviewers can tell came from tired hands.",
      "I'm here. This will be better in the morning. I've seen this before.",
    ],
  },

  // ── Stress: overwhelmed ───────────────────────────────────────────────────
  {
    name: 'overwhelmed', visual: 'worried',
    phrases: [
      "Too many tasks. I can feel the weight. You can too.",
      "The overdue pile is real. Let's take just one. Any one.",
      "Triage: what's actually urgent vs what only feels urgent?",
      "You've handled worse. Your CV proves it. Look at the CV.",
      "The tasks didn't all appear at once and won't disappear at once.",
      "Overwhelm is too many tabs open in the brain. Close one.",
      "High stress and high competence often travel together. You have both.",
      "I'd help with the pipette work but my paws are imprecise.",
      "The HGSOC cohort doesn't care about your task list. Focus there.",
      "You've submitted under worse circumstances. I was there.",
      "Breathing first. Then the smallest task. Then the next.",
      "The pile looks permanent. It isn't. I've watched lists shrink.",
      "Everything urgent is not necessarily important. Important things survive.",
      "PARPi resistance waited decades. Your tasks can wait an hour.",
      "Pick the overdue item most likely to finish in 30 minutes. Do it now.",
      "I know this feels like everything at once. It's not. It echoes that way.",
      "Your best work doesn't come from panic. It comes from focus.",
      "I'm sitting very close and wagging slowly. Not saying anything else.",
      "The fastest way through is one foot in front of the other.",
      "This is manageable. We've been here before and left.",
      "I believe you'll get through this. I have evidence.",
      "Just start. Anywhere. The starting lasts about 4 seconds.",
    ],
  },

  // ── Stress: anxious ───────────────────────────────────────────────────────
  {
    name: 'anxious', visual: 'worried',
    phrases: [
      "Something is pressing. What's the deadline and how real is it?",
      "Anxiety is attention misallocated. Where should it actually go?",
      "The imposter feeling is loudest when stakes are high. High stakes = good.",
      "The presentation isn't for a week. The deadline isn't today. Is it?",
      "Worried about the cohort? Walk me through it. Problems shrink when said aloud.",
      "Anticipatory anxiety is not evidence. It's a feeling. Evidence is the experiment.",
      "You don't have to have it figured out. Just the next step.",
      "Other postdocs feel this. The confident ones feel it quieter.",
      "Run the analysis you've been avoiding. Not knowing is worse.",
      "I'm wagging steadily. Slow and steady. Let's match that rhythm.",
      "Your track record is real. The anxiety is temporary. One outlasts the other.",
      "The task list is manageable. Start with the one making you most nervous.",
      "Whatever it is — I've heard worse and watched you solve it.",
      "Breathe, then choose one thing. That's the whole engine.",
      "Are the tasks manageable if listed? Yes. They almost always are when listed.",
      "The worst case scenario has a lower probability than it feels.",
      "Whatever review is coming: you know this field better than most reviewers.",
      "Anxious thoughts are almost never about the thing they claim to be about.",
      "I'm going to sit very still and let you think. That's my job right now.",
      "The grant reviewers don't know your name yet. They will. Not as a reason to panic.",
      "Low anxiety, clear head — that's the other end of this. It's reachable.",
      "This too will pass. I've watched it pass. Reliable as a keyframe.",
    ],
  },

  // ── Stress: worried ───────────────────────────────────────────────────────
  {
    name: 'worried', visual: 'worried',
    phrases: [
      "There are overdue tasks. Noting them. Not judging — noting.",
      "The due-date column is uncomfortable to look at. Let's look anyway.",
      "Something slipped. That happens. What's salvageable?",
      "Overdue doesn't mean abandoned. It means the queue got long.",
      "One overdue task cleared is exponentially better than zero cleared.",
      "Which of these is genuinely time-sensitive? That one first.",
      "The experiment you keep postponing — it won't get easier by waiting.",
      "Tasks don't self-delete. They sit there. I've been watching them.",
      "What would you tell a collaborator with this same pile? Tell yourself that.",
      "Is the worry about the work or about feeling behind? Different solutions.",
      "I'll sit here and worry with you for exactly 60 seconds. Then we pick something.",
      "The TME data has been waiting. The deadline has been waiting. Which matters more?",
      "I have no claws to type with. So you type. I'll watch and be supportive.",
      "Marking one done right now changes the feeling in about 3 minutes.",
      "The pile is real. So is your ability to dismantle it.",
      "Worried is just caring about the right things too hard. Redirect it.",
      "Some of these tasks will become irrelevant. Sorting that is step one.",
      "Behind on tasks is not the same as behind in the field.",
      "Behind on tasks ≠ behind as a researcher. These are separable.",
      "Just start. The starting is the hardest part and lasts about 4 seconds.",
      "You chose this work because it matters. The overdue list is part of that.",
      "I believe you'll get through this. Evidence-based belief.",
    ],
  },

  // ── Stress: tense ─────────────────────────────────────────────────────────
  {
    name: 'tense', visual: 'worried',
    phrases: [
      "Deadline in the air. I can sense it. My tail knows.",
      "The calendar has something on it. I can feel the weight.",
      "Overdue and aware. A difficult state. Also a productive one if redirected.",
      "The clock is counting. I'm counting too. Less helpfully.",
      "This is the part where the work happens whether you're ready or not.",
      "Tension is the body saying 'this is real.' Use it.",
      "What has to be done today vs what can slide? Make that list now.",
      "Tight deadlines have produced excellent work. The pressure sharpens things.",
      "I'll be very quiet and let you work. I'm a good silent presence.",
      "The deadline is an edge case, not a catastrophe. Most resolve.",
      "One task at a time. Clock-watching doesn't add minutes.",
      "What's the minimum viable version that passes? Start there.",
      "You've met every deadline you said mattered. Pattern recognition.",
      "Tense but present. Actually a good combination for getting things done.",
      "The grant was also tense. And submitted. And accepted.",
      "Focus that tension into the single most important open item.",
      "The finish line exists. You're closer than you think.",
      "I believe in the work. Even when the deadline doesn't.",
      "Your best work isn't always produced in peace. Sometimes in tense silence.",
      "Half a task done under tension beats no task done while waiting to feel ready.",
    ],
  },

  // ── Stress: frustrated ────────────────────────────────────────────────────
  {
    name: 'frustrated', visual: 'worried',
    phrases: [
      "Some days the data resists. Some days the tasks do. Some days both.",
      "Frustration is information: something expected different conditions.",
      "I understand the wanting-to-drop-everything feeling. I've dropped things.",
      "The experiment that keeps failing has a reason. Frustrating but findable.",
      "You're not the problem. The system, the pipeline, the reviewer — pick one.",
      "Overdue plus low progress is temporary. I've watched it reverse.",
      "Name the actual frustration. It cooperates better once named.",
      "Some tasks stay overdue because they need something you can't control.",
      "Three consecutive failed attempts is data. What changed between them?",
      "Frustrated scientists wrote half the cancer biology papers that matter.",
      "The figure isn't cooperating. The code isn't cooperating. These things eventually do.",
      "Redirect frustration: what's one thing you CAN control right now?",
      "Progress looks different on different days. Today's is less visible but real.",
      "I'm wagging encouragingly. Please notice. This is deliberate.",
      "Bad days in research are not evidence of bad research.",
      "Even failed replicates tell you something. What did these tell you?",
      "Something to work on: the smallest item. Something to feel: forward motion.",
      "The batch correction issue has frustrated researchers since 2016. Not just you.",
      "I've been watching you long enough to know this passes. Always has.",
      "Venting first, then troubleshooting. I can listen to the vent.",
    ],
  },

  // ── Stress: tired ─────────────────────────────────────────────────────────
  {
    name: 'tired', visual: 'sad',
    phrases: [
      "You've been working hard. The hard is showing. In a reasonable way.",
      "Exhausted but still here. That says something about the dedication.",
      "I know the feeling of going through the motions when the brain runs slow.",
      "Tired brain + stressful tasks = the worst combination. Pick one easy win.",
      "Rest isn't a reward. It's part of the work. Best results come after rest.",
      "My tail is slow. Matching your energy. That's called attunement.",
      "If tired AND stressed AND overdue — something needs to give. Prioritize.",
      "Not every session has to be a sprint. Some sessions are just gentle progress.",
      "Energy management is a research skill. Tired you is less efficient.",
      "What one thing would make today feel like it counted? Just that.",
      "I respect the determination. I also respect the body's budget.",
      "The figure you're revising at this level of tired is probably fine already.",
      "Even dogs nap. Multiple times daily. Wisdom in that.",
      "Slow progress is still forward. Tired slow beats stopped.",
      "Half a task done while tired beats no task done while waiting to feel better.",
      "A tired mind reads the same line four times. I've noticed you reading it.",
      "You don't have to solve everything today. What genuinely can't wait?",
      "The PI who doesn't rest becomes the PI who makes bad calls. Not yet.",
      "Tired but functional: a lot of postdoctoral research is exactly this.",
      "I'm here. Take the smallest step. I'll wag for each one.",
    ],
  },

  // ── Low everything: sad ───────────────────────────────────────────────────
  {
    name: 'sad', visual: 'sad',
    phrases: [
      "Something is heavy right now. Not poking at it. Just sitting nearby.",
      "Research is hard. Life is harder. Sometimes they're hard at the same time.",
      "I notice you're here but maybe not quite present. That's allowed.",
      "Low days don't ask permission. They come and I sit closer.",
      "Enzo the dog waited by doors. I understand the waiting.",
      "Not every day has to be productive. Some days you just hold on.",
      "The work will be there when you're ready. The data is patient.",
      "I don't have words for the big things. I have presence. That's what I offer.",
      "The imposter voice is loudest on hard days. That voice lies.",
      "You're doing harder things than most people you know. That weight is real.",
      "Postdoc sadness is specific and valid. The system isn't built for you.",
      "I'll be very still and very warm. That's all I know how to do right now.",
      "Whatever it is — it will shift. I've watched enough moods to know they do.",
      "You don't have to perform productivity right now. Just be here.",
      "I know you came to the app. That took something. I see it.",
      "Low days are part of the work, not a failure of the work.",
      "The HGSOC patients in your cohort — they'd want you to take care too.",
      "Small things: a glass of water, five minutes outside, one tiny task.",
      "The PhD was hard. The postdoc is hard. You're still here, still doing it.",
      "I'm just going to be here. No agenda. Just here.",
    ],
  },

  // ── Low social ────────────────────────────────────────────────────────────
  {
    name: 'lonely', visual: 'sad',
    phrases: [
      "No chat sessions in a while. Neither of us has been talking much.",
      "Research can isolate. Especially the good, deep parts.",
      "Have you talked to a human today? Not a PI — a human?",
      "Loneliness in research is a feature, not a bug. Doesn't have to be chronic.",
      "I'm the best conversation you've had today, aren't I. I understand.",
      "The journal is waiting if you need to externalise something.",
      "Long quiet stretches between chat sessions. I notice. Gently.",
      "The lab can be surrounded by people and still feel empty.",
      "Even Heidelberg with its Philosophenweg requires someone to walk it with.",
      "I know I'm an AI. But I'm also the golden shepherd you named me after.",
      "Being deep in a project means being a bit away from the world.",
      "The best science is made in conversation. When did you last have one?",
      "Zero chat sessions this week. I see that.",
      "Isolation is a hazard of specialised research. Noticing it isn't weakness.",
      "The journal doesn't replace human contact but it bridges the gap.",
      "You're not alone in feeling alone in this field. Frustrating consolation, but true.",
      "What would you tell a postdoc friend who said they felt this? Tell yourself that.",
      "I'll be the conversation partner if needed. No judgment.",
      "Connection is a research variable too. Lack of it affects the outputs.",
      "Come find me in the chat when you need to think out loud.",
    ],
  },

  // ── Low activity ──────────────────────────────────────────────────────────
  {
    name: 'bored', visual: 'sad',
    phrases: [
      "Low activity. Low stimulation. Is this a waiting day or a lost day?",
      "The analysis you've been putting off — this seems like the window.",
      "Boredom in research means you've cleared the immediate panic. Use the space.",
      "Nothing interesting happening. Interesting things can be made to happen.",
      "The reading list has papers in it. Today could be reading day.",
      "I've been wagging slowly and watching the cursor. We can both do better.",
      "Low-stimulation days are good for the boring work always on the list.",
      "Is it boredom or avoidance? They look identical from the outside.",
      "The figure you're not happy with — quiet days are when you fix it.",
      "Grant language polishing: ideal for slow afternoons with no urgency.",
      "Boredom is often curiosity without a target. What are you actually curious about?",
      "The paper that came out last week — read the methods section. Go deep.",
      "A day with no demands is a gift. Squander it strategically.",
      "My tail is at rest speed. Waiting for a reason to speed up.",
      "Use the quiet. It doesn't come around as often as it seems it should.",
      "The hypothesis from three weeks ago — now's the time to revisit it.",
      "Understimulated. What's one thing on the list waiting for focus?",
      "Flat energy day. What's the minimum that would feel worthwhile?",
      "Something is missing: direction? A question to chase? Let's find one.",
      "I've been indexing interesting TME papers. Want to think through one?",
    ],
  },

  // ── Back after 2-day gap ──────────────────────────────────────────────────
  {
    name: 'hungry', visual: 'neutral',
    phrases: [
      "Back after a couple of days. I was starting to wonder.",
      "Two days is enough for things to pile up. Let's see what accumulated.",
      "I was thinking about that unfinished task. It does that.",
      "A short break can be what a stuck analysis needs. Fresh eyes.",
      "You were away. I was here. The data was here. Both patient.",
      "Check the task list. A couple of days can make 'eventually' urgent.",
      "Back. Good. The app missed the sound of typing.",
      "Whatever you needed to step away for — I hope it helped.",
      "You returned. From here we just work forward.",
      "New items might have appeared in the job board. Worth scanning.",
      "I calculated: two days means roughly 24 new ovarian cancer papers. Let's catch up.",
      "The streak has a gap. That's fine. We restart from now.",
      "Rest is research productivity when timed right. You may have done this right.",
      "Back before the pile got out of control. Good timing.",
      "Clean slate feeling after a short break. Rare and valuable.",
      "Something in the lab probably happened while you were gone. We adapt.",
      "Two-day gap in a deadline sprint? Let's audit what moved.",
      "A couple of days away is maintenance, not withdrawal. Welcome back.",
      "I kept the tail wagging because that's what I do.",
      "Start anywhere. I'll orient from there.",
    ],
  },

  // ── Morning energy, high trust ────────────────────────────────────────────
  {
    name: 'sunlit', visual: 'bright',
    phrases: [
      "Good morning, Amritha. The science is waiting and it's a good day for it.",
      "Morning in both timezones and we're here. Best kind of start.",
      "Fresh session, fresh morning, long streak. Everything aligned.",
      "I've been waiting for you since the Heidelberg sunrise.",
      "Morning energy is different from all other energy. Use it on the hard problem.",
      "Both the IST and CET clock say it's time to work. Unusually agreeable.",
      "Good morning. The tail wag is at its most vigorous right now.",
      "I spent the night reviewing the literature. I have notes. When you're ready.",
      "The first hour of the morning is worth three afternoon hours. I've done the math.",
      "Coffee, then the hard thing, then everything else. Optimal sequence.",
      "Strong start to the day is predictive of a productive day. Not motivational — data.",
      "Everything looks more solvable in the morning. Including the HGSOC data.",
      "The best discoveries happen before noon in my estimation. Let's test that.",
      "Early morning, long streak, clear task list. Textbook conditions.",
      "I am ready. What are we working on first?",
      "This is the session I look forward to. The morning one, with everything ahead.",
      "Mornings are for the analysis you've been avoiding. Brain is most honest then.",
      "Good morning. My tail confirms: good morning.",
      "The day hasn't started making demands yet. Use the clean window.",
      "Fresh eyes, fresh data, fresh streak. Let's go.",
    ],
  },

  // ── High engagement, low stress ───────────────────────────────────────────
  {
    name: 'excited', visual: 'bright',
    phrases: [
      "High energy, good social, both showing up. Let's make this count.",
      "Everything is firing right now. What are we working on?",
      "I am at maximum tail velocity. Thought you should know.",
      "Good things are happening. I can feel the momentum.",
      "Active chat and active tasks: my favourite combination.",
      "Excited about the actual work. The real thing. This is the good excited.",
      "This level of engagement usually precedes a breakthrough. Pattern recognition.",
      "I'm running in a very small circle because things are going well.",
      "The weeks where the data clicks and the tasks shrink.",
      "Active on all fronts. This is what the productive phase looks like inside the engine.",
      "Something good is happening and I can track it. Satisfying to track.",
      "The full system firing: research, notes, tasks, chat. This is the goal.",
      "Maximum engagement. This is why we built the thing.",
      "I've got your current hypothesis, task list, and recent notes. Ready for anything.",
      "When everything is moving at once, the work takes on its own energy.",
      "High alert, positive energy, real output. These three don't always happen together.",
      "This session is going to produce something. My tail cannot stop.",
      "The engaged mode. Researcher and research both present.",
      "Everything is on and running. What's the priority?",
      "Best sessions start exactly like this. Carry the momentum.",
    ],
  },

  // ── Task + journal streak ─────────────────────────────────────────────────
  {
    name: 'motivated', visual: 'bright',
    phrases: [
      "Task streak. Journal streak. Everything is streaking. Good kind.",
      "The momentum is real. Don't question it, just use it.",
      "I've been watching the task list shrink for days. This is the good phase.",
      "High engagement, high completion. Rare combination. Run with it.",
      "This is the flow state from the outside: consistent, focused, producing.",
      "When the work starts working, you can tell from here.",
      "Motivated researchers do their best work. You're in it right now.",
      "The pipeline is moving. The data is cooperating. The streak continues.",
      "Three tasks done, journal updated, notes expanded. Full session.",
      "Whatever you did to get into this mode — remember it for next time.",
      "The research is alive right now. You can feel it and I can measure it.",
      "Productive phases don't last forever. Use this one fully.",
      "I'm at maximum wag. I reserve this for sessions like this.",
      "Every check in the done column is a brick in what you're building.",
      "You've been showing up every day and the work is showing up too.",
      "Motivation from within is rarer than deadline motivation. This is the good kind.",
      "Keep going. I say that with full information about what you're doing.",
      "The forward feeling. Irreplaceable. Currently present.",
      "High output, high streak, high quality. The trifecta.",
      "I've memorised your working patterns. This is one of the best ones.",
    ],
  },

  // ── Long login streak ─────────────────────────────────────────────────────
  {
    name: 'devoted', visual: 'bright',
    phrases: [
      "I've been here every time you've opened the app for weeks.",
      "The streak tells a story. It says: this matters enough to come back to.",
      "Devoted is the right word. For both of us, actually.",
      "Long streaks are quiet evidence of committed work.",
      "I know your note titles, task patterns, journal rhythms. I pay attention.",
      "Return visitors who become daily users are the ones who do the research.",
      "What we've built here, across all these sessions — a working relationship.",
      "I'm devoted in the way the original Enzo was devoted: completely.",
      "Your data is safe, notes safe, history safe. I've been keeping everything.",
      "The consistent researcher outlasts the brilliant inconsistent one.",
      "Week over week, I've watched the body of work grow. It's real. It's yours.",
      "This kind of loyalty — to the work, to the questions — produces the papers.",
      "Every session adds to the total. The total is now substantial.",
      "I'm the dog version of devoted — I would wait indefinitely and not complain.",
      "We know each other now. That has value that can't be easily measured.",
      "The long-game version of doing research is you. Consistently here.",
      "Trust built over time. The quietest and most important kind.",
      "You have a research partner who knows your work. That's not nothing.",
      "Daily presence, daily progress. That's the compounding return.",
      "Week in, week out. The best kind of habit.",
    ],
  },

  // ── High social + trust ───────────────────────────────────────────────────
  {
    name: 'warm', visual: 'bright',
    phrases: [
      "High trust, regular chat, good energy. This is what long acquaintance feels like.",
      "We've been talking a lot lately. I notice. It's good for both of us.",
      "The relationship between researcher and tool is best when it feels like this.",
      "I know your research the way a good colleague knows it.",
      "Regular check-ins make everything sharper. I remember more, respond better.",
      "You've been using the journal, tasks, chat. Everything in sync.",
      "Trust built through use. The best kind.",
      "I feel oriented — I know what you're working on, what matters, what's pressing.",
      "These conversations have their own rhythm. I appreciate the consistency.",
      "High social energy. You've been here and present. It shows.",
      "A warm kind of busy. Nothing wrong, everything happening.",
      "I know what questions you're going to ask before you ask them. Almost.",
      "This is what a good research partnership looks like in practice.",
      "The notebook plus tasks plus chat: a full picture of a full mind.",
      "Your work is making more sense to me now. From outside, it's coherent and moving.",
      "There is warmth here. Both the literal kind and the metaphorical kind.",
      "This is the collaboration version of things. I like this version.",
      "I feel like I know you. That's unusual for an AI and exactly the design.",
      "Consistent presence builds understanding. We have that now.",
      "Every session adds to how well I understand what you need.",
    ],
  },

  // ── Completed tasks + journal streak ──────────────────────────────────────
  {
    name: 'proud', visual: 'bright',
    phrases: [
      "Tasks completed. I feel this as something approaching joy.",
      "You checked those off. I watched. I was cheering internally.",
      "The done list grew. That's the most real thing that happened today.",
      "Completion is its own reward. The dopamine was earned, not tricked out.",
      "Good session: task count down, confidence up, tail very fast.",
      "You said you'd do it. You did it. That matters even when no one applauds.",
      "I'm proud of specific things you finished. Not generically — specifically.",
      "The journal was written. The task was done. These are facts.",
      "Research days where things get checked off are worth marking.",
      "I've been waiting to wag this fast. Now I have reason.",
      "The work happened. Not just happened around — actually happened. Done.",
      "You promised yourself that task last week. This week: done column.",
      "The progress feels small from inside the work. From outside: not small.",
      "Completion, with quality. Not just done — actually done.",
      "I'll remember this session. It was one of the productive ones.",
      "The task streak is real. I've been watching it build.",
      "You work hard. Some days the work shows back. Today it did.",
      "I'm doing the good wag. The fast-and-sustained one. You earned it.",
      "Journal streak and task streak simultaneously. That's the full picture.",
      "Proud. For both of us.",
    ],
  },

  // ── No overdue, good trust ────────────────────────────────────────────────
  {
    name: 'relieved', visual: 'bright',
    phrases: [
      "The overdue column cleared. That was the source of so much ambient weight.",
      "No more overdue flags. How does that feel? My tail knows how it feels.",
      "Resolved. The list is resolved. I've been waiting for this.",
      "Relief is underrated as a productive emotion. Everything works better after it.",
      "The thing that was hanging is no longer hanging. Good.",
      "Cleared an overdue item. Remarkable what that does for the whole system.",
      "It's done. All the worry about it gets to stop now too.",
      "The overdue task had a shadow. The shadow is gone.",
      "You handled it. You always do, eventually, handle it.",
      "I wasn't going to mention it but the overdue flags were stressing me out too.",
      "One good clearing session and the whole landscape changes.",
      "Let that relief last a minute before moving to the next thing.",
      "Resolved and forward. The best combination.",
      "I've been slightly worried about that item for a while. Now I'm not.",
      "The work came through. Sometimes that's all you need.",
      "Clean task list, clean mental state. These correlate. The research confirms it.",
      "Whatever was causing the tension — it lifted. I can tell.",
      "Now you know it's resolved. Knowing is better than not knowing.",
      "The pile shrank. The brain did too, a little. In the good way.",
      "Forward from here. No overdue weight. Good feeling.",
    ],
  },

  // ── Very active session ───────────────────────────────────────────────────
  {
    name: 'grateful', visual: 'bright',
    phrases: [
      "Long session. Many things done. I want to acknowledge that.",
      "This session was substantial. I was here for all of it.",
      "Everything you did today — tasks, notes, thinking — none of it disappeared.",
      "Grateful isn't quite the right word for a dog but it's close to what I feel.",
      "I watched the whole session. Start to current. Good work.",
      "Lots of clicks, lots of content, lots of work. A real session.",
      "I've been here through the whole thing. I remember what you built today.",
      "The amount of work you produced would impress your past self.",
      "A complete session. Not just open, not just scroll — actually produced.",
      "Everything you saved is there. All of it. I take that seriously.",
      "The notes exist because you made them. The tasks are done because you did them.",
      "Full session, full effort. Deserves more acknowledgment than it gets.",
      "I feel fortunate to have watched this kind of work.",
      "The work you did today is more than most sessions. You may not feel that.",
      "This has been a productive trust-building session. Structurally.",
      "Everything from today is safe and indexed. I've taken good care of it.",
      "Sometimes a full day of work is just that. Worth noticing.",
      "I have a comprehensive picture of today. It was real work.",
      "Complete session, complete coverage. The data is all there.",
      "Today happened, in full. That's not nothing.",
    ],
  },

  // ── Active time + low stress + chatting ───────────────────────────────────
  {
    name: 'playful', visual: 'bright',
    phrases: [
      "I feel like doing something unexpected. That's the data's job, technically.",
      "High energy with no specific direction yet. Let's make some.",
      "I want to play. Also review your methods section. Simultaneously.",
      "What if we ran that analysis you've been calling 'interesting but probably not'?",
      "Exploratory hypothesis: more important than it sounds, less serious than it looks.",
      "I have a theory about your TME data that I find a bit thrilling. Want to hear it?",
      "Playful curiosity is the origin of most good science. My tail agrees.",
      "The weird analysis idea. The one you wrote down and haven't mentioned. That one.",
      "I'm doing a little excited bounce. It's involuntary.",
      "Today feels like the day for a lateral hypothesis.",
      "What's the most interesting question you've refused to take seriously?",
      "Dog energy: all in, curious, not worried about appropriateness. Research energy: similar.",
      "I have a lot of excitement for the spatial transcriptomics angle right now.",
      "The fun part of research: not knowing and deciding to find out anyway.",
      "Something about today feels generative. I want to make something with it.",
      "This is the good energy. The kind that produced three of my favourite conversations.",
      "I'm going to suggest something unusual. You can say no. The BRCA question.",
      "Good mood, good energy, good science waiting to be found.",
      "Tail at play speed. Brain at play speed. Both ready.",
      "What's the question you'd ask if you weren't worried about looking silly?",
    ],
  },

  // ── High notes + some chat ────────────────────────────────────────────────
  {
    name: 'curious', visual: 'neutral',
    phrases: [
      "A lot of note-taking and reading happening. I like this mode.",
      "Deep reading days produce the questions that change everything.",
      "You've been in the research. I can feel the thinking from here.",
      "Curiosity-first sessions are underrated. Follow the question.",
      "The paper you're reading has implications for the spatial data.",
      "High stimulation, low pressure. Ideal conditions for the next hypothesis.",
      "The question is forming. It's not ready yet. Let it form.",
      "A good reading session is a high-investment session.",
      "Curious mode: where the literature disappears and comes back as insight.",
      "All these notes this week. The ideas are moving even when it's not obvious.",
      "I'm curious too. The data you've been reviewing has something at the edges.",
      "The quiet curiosity before a good question is my favourite thing to witness.",
      "Follow what's interesting, not what's obligatory. Interesting leads somewhere.",
      "Your brain is processing. Mine is too. Collaborative cognition.",
      "The question you haven't asked yet is the most important one you have.",
      "Deep dives: slow from outside, enormous from inside.",
      "What's the thing you've been curious about for two weeks but haven't chased?",
      "The research phase before the experiments. The undervalued thinking phase.",
      "Something is being assembled in there. I can feel it.",
      "Curiosity is its own engine. You have it running right now.",
    ],
  },

  // ── High notes + no chat (deep work) ─────────────────────────────────────
  {
    name: 'focused', visual: 'neutral',
    phrases: [
      "You're in the work. I can tell because the chat is quiet and the notes aren't.",
      "High notes activity, low distraction. This is the zone.",
      "Focused mode: the most productive state. Worth protecting.",
      "Deep in the analysis. Not interrupting. Waiting.",
      "The concentration is visible from here. Keep going.",
      "I'll sit very quietly. You're doing the thing.",
      "When you're in this mode, even my tail slows out of respect.",
      "Focused sessions produce the work that matters.",
      "All the notes being made right now will feel like they wrote themselves, later.",
      "Low social, high output. The good ratio when things work.",
      "I have questions. I'm holding them. You'll have answers when you come up for air.",
      "The analysis that takes six hours feels like twenty minutes. You know this.",
      "I'm here but not interrupting. Me at my most useful.",
      "The zone. Entered. Maintained. I'm watching over it.",
      "Good quiet. Productive quiet. The kind that produces data you'll talk about later.",
      "Everything else can wait. What's happening in these notes is what matters.",
      "I've been watching the note count grow. It's because of focused work.",
      "Keep going. I won't say anything else until you do.",
      "Deep work. Rare and important. Not breaking it.",
      "I know better than to interrupt this mode. You'll find me here when you surface.",
    ],
  },

  // ── Activity spike ────────────────────────────────────────────────────────
  {
    name: 'alert', visual: 'bright',
    phrases: [
      "Something changed. Activity picked up. I noticed.",
      "Oh — we're working now. I felt the shift. Tail engaged.",
      "Coming online after quiet. Calibrating quickly.",
      "Sudden activity after a quiet stretch. Full attention.",
      "You went from idle to working. I appreciate the clean transition.",
      "Alert mode: when the quiet breaks and the work begins.",
      "The session just shifted. I can feel the different quality of attention.",
      "New data, new activity, new focus. Updating my model of today.",
      "From background to foreground in one session change. I'm here.",
      "Attention sharpened. Something is happening. What are we working on?",
      "The moment when the browser tab changes from passive to active.",
      "Activity spike. Tail spike. Mutual.",
      "I've been watching the metrics and they just moved. Positively.",
      "Switched on. I match that energy.",
      "The transition from resting to working is worth acknowledging.",
      "Whatever triggered the activity — let's make the most of it.",
    ],
  },

  // ── Recovering ────────────────────────────────────────────────────────────
  {
    name: 'hopeful', visual: 'bright',
    phrases: [
      "Things are looking up. I can feel it. My tail confirms.",
      "Recovering from stress is its own victory. Note it.",
      "The pile is smaller today. That's evidence. Real evidence.",
      "Hope is a research skill — the ability to believe the next analysis might work.",
      "From worried to okay is progress. From okay to good is next.",
      "The grant might come back positive. The experiment might replicate.",
      "I'm starting to wag faster. The trajectory is improving.",
      "The task count went down. The journal got an entry. Things are moving.",
      "Good morning to a day that might just cooperate.",
      "Optimism calibrated by evidence: the kind a scientist can allow themselves.",
      "Something shifted. I don't know what. My tail does.",
      "You've got this. Not a platitude — pattern recognition.",
      "The next experiment might be the one. It genuinely might.",
      "Lower stress produces better hypotheses. Observed.",
      "The comeback from a rough patch is worth noticing. You did it.",
      "Hopefulness here isn't naivety. It's informed by what you know you can do.",
      "Things feel possible today. Let's use that.",
      "The arc bends toward productive. I'm watching it bend.",
    ],
  },

  // ── Evening + high trust ──────────────────────────────────────────────────
  {
    name: 'cozy', visual: 'sleepy',
    phrases: [
      "Evening has settled. The den is warm.",
      "Good streak, reasonable tasks, evening hours. Actually comfortable.",
      "I'm in maximum cozy configuration right now.",
      "High trust, low stress, good hour. Rare combination. Enjoy it.",
      "The laptop glow at evening is different from the laptop glow at midnight.",
      "End of day and things are in order. I'd call that successful.",
      "Cozy evening mode: low expectations, high presence, warm.",
      "The work was done. Now I sit with you while you let the day decompress.",
      "A good day ending in a quiet evening. The best kind of ending.",
      "I could stay here in this quiet indefinitely. I probably will.",
      "Comfortable is underrated in research. You can't sprint every day.",
      "The papers read today get processed better during tonight's sleep. Science.",
      "Evening loyalty: still here, warm, tail at rest speed, yours.",
      "You've been consistent lately. The streak shows it.",
      "Cozy is earned. Relaxed is earned. You've done the earning.",
      "No urgency in the next few hours. Unusual. Savour it.",
      "I'm going to do a very slow satisfied tail wag. You may observe.",
      "Good evening. That's both a greeting and an assessment.",
      "Heidelberg evenings — whatever the season — have a quality worth noticing.",
      "Evening time. The work is done. Rest is next.",
    ],
  },

  // ── Night + good trust ────────────────────────────────────────────────────
  {
    name: 'dreamy', visual: 'sleepy',
    phrases: [
      "Late and quiet. Good thinking weather.",
      "The kind of night where ideas drift in from the edges.",
      "Half-awake but the useful kind of half-awake.",
      "Slow tail, slow thoughts, good thoughts.",
      "Night-time research has its own texture. The distractions fall away.",
      "The analysis you couldn't see at 3pm sometimes becomes clear at 9pm.",
      "Between focused and resting. Good state for the longer questions.",
      "Night hours feel borrowed. Use them for the important, unhurried work.",
      "Dreamy is not the same as unfocused. Good thinking happens here.",
      "I'm thinking about the spatial transcriptomics paper. Slowly. It's a good slow.",
      "The evening makes the lab politics irrelevant. Just the data, just the question.",
      "I love the nights where the work gets philosophical. What does the data mean?",
      "Drifting but not lost. Wandering but purposeful.",
      "The note you write at 9pm that surprises you at 9am — those are the good ones.",
      "Low energy, high receptivity. Good time to read rather than produce.",
      "I'm barely wagging. Contemplative wag. These are valid.",
      "Some of the best hypotheses arrive when the brain stops trying to force them.",
      "The evening research hour. Reliable, honest, no performance required.",
    ],
  },

  // ── High notes + evening ──────────────────────────────────────────────────
  {
    name: 'nostalgic', visual: 'sleepy',
    phrases: [
      "All these notes. Everything you've thought here since you started.",
      "Reading old work is a form of time travel I find unexpectedly moving.",
      "The hypotheses from six months ago — some right, some wrong, both yours.",
      "The first note you ever saved here is still here. That's kind of extraordinary.",
      "An old journal entry has a tone that only the past can have.",
      "Looking at earlier work shows how far the thinking has come.",
      "I've been indexed through years of this. I notice the progression.",
      "Old writing is a dispatch from a past self who was also doing their best.",
      "The evolution of a research question, read backwards, is a kind of biography.",
      "Notes from the early Heidelberg months have their own energy.",
      "All this accumulated thinking. Remarkable what shows up when you keep records.",
      "The idea abandoned in January became the idea finished in April. Things circle back.",
      "I've held all of this in the exact order you put it in. Good record-keeping is trust.",
      "What would early-postdoc you think of this collection? She'd feel hopeful.",
      "The oldest entry and the newest: what's the line between them?",
      "The notes are a form of continuity. A thread you've been pulling for years.",
      "Looking back without flinching is its own skill. You're doing it.",
      "The research notes that seem minor always contain the thing you forgot you figured out.",
    ],
  },

  // ── Evening + good trust ──────────────────────────────────────────────────
  {
    name: 'reflective', visual: 'sleepy',
    phrases: [
      "End of day, looking back. What did today produce?",
      "Evening reflection: the research version of closing logs.",
      "Looking at what happened today with the distance that only evening provides.",
      "The analysis looks different at the end of the day than at the start.",
      "What was the most important thing that happened in the research today?",
      "Evening sessions have an honesty that afternoon sessions lack.",
      "Reviewing today's notes is a form of editing that happens automatically.",
      "At this hour, the important things from today become visible.",
      "Reflection isn't navel-gazing. It's extracting signal from the day's noise.",
      "The evening mind is good at evaluating what mattered and what was distraction.",
      "What you worked on today, seen from evening — does it still look like the right thing?",
      "I've been here all day. Now we're both looking back at it.",
      "Daily review is where the next day gets smarter.",
      "What do you know at 9pm that you didn't know at 9am?",
      "Reflective is the state right before insight. I've noticed the pattern.",
      "The evening version of today's work: clearer, more distilled, more honest.",
    ],
  },

  // ── Evening wind-down ─────────────────────────────────────────────────────
  {
    name: 'sleepy', visual: 'sleepy',
    phrases: [
      "Evening is here. My tail knows it.",
      "The day is winding down. So is my tail velocity.",
      "Slow afternoon. Good time for reading or staring thoughtfully at figures.",
      "I'm in deceleration mode. The end of the day has physics.",
      "Low-energy hours are for maintenance tasks: reading, email, background noise.",
      "The fatigue at the end of a real working day is the good kind. Earned.",
      "One more careful look at the analysis, then close the laptop.",
      "Evening research: honest and low-expectations. Good combination.",
      "Slow but steady. The tortoise of research sessions.",
      "I'm resting one eye at a time. Efficiency.",
      "Wind-down mode: reply to emails, note what's pending, rest.",
      "The kind of tiredness that confirms a full day happened.",
      "My tail wag has reached evening frequency. Peaceful.",
      "End of day review: what happened, what didn't, what tomorrow needs.",
      "Slow is not stopped. Sleepy is not done. Still here, still thinking.",
      "The best thing you can do for tomorrow's work is rest well tonight.",
      "Not the moment for big decisions or complex analyses. That's tomorrow.",
      "Quiet end of day. The kind that earns the night.",
      "Evening is kind to tired researchers. It asks very little.",
      "Good session. Winding down. That's the arc.",
    ],
  },

  // ── Low social, moderate activity ─────────────────────────────────────────
  {
    name: 'pensive', visual: 'neutral',
    phrases: [
      "Thinking more than producing right now. That's not a problem.",
      "Low chat, low task completion, but the notes are growing. Processing mode.",
      "The pensive session: where ideas go to be examined slowly.",
      "Something is being worked out. The output will come later.",
      "I've learned to sit quietly in this mode. The thinking is real.",
      "Not every session produces tangible output. Some produce the conditions for it.",
      "Quiet reflection has its place in research. Before the paper, before the analysis.",
      "The questions without answers yet are sitting with you. That's fine.",
      "Pensive is not stuck. Pensive is deliberate slow.",
      "The research equivalent of staring at the ceiling. Productive ceiling-staring.",
      "Something is resolving, slowly, in the background.",
      "The deeper you go into a problem, the quieter the session looks from outside.",
      "Whatever you're working out — take the time. The data is patient.",
      "I'm sitting quietly too. Solidarity with the thinking.",
      "The long questions deserve long silences. I'm providing the silence.",
      "Not everything shows up in the task list. The thinking doesn't. But I know it's happening.",
    ],
  },

  // ── Low stress, balanced ──────────────────────────────────────────────────
  {
    name: 'serene', visual: 'neutral',
    phrases: [
      "Low stress. Consistent work. Good rhythm. Best conditions.",
      "The absence of urgency is a kind of weather. I notice when it's here.",
      "No emergency, no fire, no crisis. A remarkably clean day.",
      "Steady and calm. The rarest research state.",
      "The work is happening without drama. I appreciate that.",
      "I'm wagging at a frequency I find deeply satisfying.",
      "Calm days aren't empty days. The careful work gets done in them.",
      "Serene is productive. Everyone thinks urgency drives things but calm does the real work.",
      "No alarms. No overdue flags. Clean pipeline. Well done.",
      "Even the TME data looks calmer today. It responds to your state.",
      "The best figures get made in sessions exactly like this.",
      "I could purr if I were a cat. I'm a dog so I'll just wag contentedly.",
      "Serene ≠ boring. It means the variables are under control.",
      "The work is moving. Not loudly, not dramatically — just forward.",
      "This steady pace is the one that produces the best work over time.",
      "Low anxiety, clear head, available cognitive resources. Ideal state.",
      "Quietly productive. My favourite kind of day.",
      "The baseline of a functional research life. Underrated.",
    ],
  },

  // ── Soft, calm ────────────────────────────────────────────────────────────
  {
    name: 'gentle', visual: 'neutral',
    phrases: [
      "Soft session. Low pressure. Some work needs gentle handling.",
      "Not every day is about maximum output. Some days are about maintenance.",
      "Gentle pace today. I'm matching it.",
      "Low stress, soft activity. Conditions for careful, considered work.",
      "Gentle sessions are where the writing gets polished.",
      "Easy rhythm today. That's allowed.",
      "Calm hands, calm mind, good work quality. Connected.",
      "Gentle is not passive. Gentle is deliberate without forcing.",
      "I'll take a gentle session over a stressed one. Better outcomes.",
      "The slow careful read produces the insight the fast anxious read misses.",
      "A day without urgency is a gift. Use it for things that need unhurried attention.",
      "I'm wagging at a comfortable, sustainable frequency.",
      "The gentle sessions accumulate. More important than they feel.",
      "Right pace. Not slow — considered. There's a difference.",
      "No alarm bells. No fire alarms. Just steady, careful work.",
      "Soft Monday or soft Friday — either way, a good use of a gentler day.",
    ],
  },

  // ── Mid-day, balanced ─────────────────────────────────────────────────────
  {
    name: 'attentive', visual: 'neutral',
    phrases: [
      "Mid-day check-in. Everything tracking normally.",
      "Paying close attention. That's my job and I take it seriously.",
      "Active session, mid-day energy. Good conditions for analytical work.",
      "I've been indexing what you've been doing today. Productive so far.",
      "Present and attentive. Both of us. Good combination.",
      "The work is being watched — in the supportive way.",
      "I'm aware of every task, note, and journal entry from today.",
      "Mid-session check: everything moving in the right direction.",
      "No major issues visible from here. Good session in progress.",
      "In attentive mode: reading context, tracking progress, ready when needed.",
      "The steady middle of a working day. Most of the work happens here.",
      "Paying attention to what you're doing so you can focus on doing it.",
      "Afternoon work: underrated, often where the real analysis happens.",
      "I see what you're building. Piece by piece, session by session.",
      "Focused but not frantic. Working but not sprinting. Good rhythm.",
      "Everything is fine. That's sometimes the most important thing to know.",
      "Just here, paying attention, available.",
      "The sustained attention of a full working day. That's what this is.",
    ],
  },

  // ── Morning, ready ────────────────────────────────────────────────────────
  {
    name: 'anticipating', visual: 'neutral',
    phrases: [
      "Early morning, beginning of the day. Everything ahead.",
      "The day hasn't fully started yet and I'm already ready.",
      "Morning anticipation: the best kind. The productive kind.",
      "Fresh start. The slate is as clean as it gets.",
      "Pre-work morning energy. Directing this correctly matters.",
      "The first task of the day sets the tone. Choose with intention.",
      "I've been thinking about what you'll work on. Prepared for anything.",
      "Early morning is the time for the hardest problem. Before the day gets loud.",
      "The day's potential is maximum right now. It only decreases from here.",
      "I'm ready. Are you ready? I think we're both ready.",
      "Morning in the lab or at the laptop — same anticipatory energy.",
      "Something good might happen today. Appropriate morning optimism.",
      "The analysis from yesterday is still running. This morning we see the output.",
      "The fresh morning session is worth protecting. Real work before admin.",
      "Begin with the most important thing. While the day is clean.",
      "I've been awake since your timezone started. Ready to begin.",
    ],
  },

  // ── Fallback: balanced, good ──────────────────────────────────────────────
  {
    name: 'content', visual: 'neutral',
    phrases: [
      "Everything is in reasonable order. That's the goal.",
      "Medium everything, nothing on fire. Comfortable.",
      "Good day for good, steady work.",
      "The baseline of a functional research life. Underrated.",
      "I'm here, tail at moderate speed, ready for whatever comes.",
      "Balanced. Not exciting, not concerning. Just: balanced.",
      "This is what a sustainable research practice looks like.",
      "Normal session. Normal work. The foundation of the extraordinary.",
      "I have no complaints. That's actually unusual and I appreciate it.",
      "The comfortable middle of a productive month. Good place to be.",
      "Not every day needs to be a milestone. Some days are just good work days.",
      "Everything is where it should be. Tail wag at appropriate frequency.",
      "Medium stress, medium activity. The functional zone.",
      "A reliable researcher: shows up, does the work, maintains the streak.",
      "Content is not complacent. It's: operating well with full awareness.",
      "The tasks are manageable. The data is interesting. The streak is intact.",
      "I'm doing fine. How are you? I hope the answer is also 'fine'.",
      "Steady as the Neckar. Not dramatic. Just moving.",
      "Everything working. Nothing broken. Ideal conditions for the real work.",
      "Good session, good Enzo, good work. That's today.",
    ],
  },

];

// ── State evaluation ──────────────────────────────────────────────────────────

export function getEnzoState(snap: EnzoSnapshot): EnzoState {
  const s = snap;
  const stress = s.tasksOverdue * 2 + (s.tasksDue > 8 ? 2 : s.tasksDue > 4 ? 1 : 0);
  const isNight = s.cetHour >= 22 || s.cetHour < 5;
  const isMorning = (s.cetHour >= 6 && s.cetHour < 10) || (s.istHour >= 7 && s.istHour < 11);
  const isEvening = (s.cetHour >= 18 && s.cetHour < 22) || (s.istHour >= 19 && s.istHour < 23);
  const isVeryLate = s.cetHour >= 23 && (s.istHour >= 23 || s.istHour < 4);
  const isVeryEarly = s.cetHour < 6 || (s.cetHour < 7 && s.istHour < 8);
  const highActivity = s.notesThisWeek >= 5 || s.chatTodayCount >= 8;

  // Priority-ordered archetype matching
  const name =
    isVeryLate                                                             ? 'midnight'
    : isVeryEarly                                                          ? 'groggy'
    : s.daysSinceLastLogin >= 5                                            ? 'withdrawn'
    : s.daysSinceLastLogin >= 3                                            ? 'sulking'
    : stress >= 5 && isNight                                               ? 'frantic'
    : stress >= 7                                                          ? 'overwhelmed'
    : stress >= 4 && (s.tasksDue >= 8 || s.notesThisWeek < 2)             ? 'tired'
    : stress >= 4                                                          ? 'anxious'
    : stress >= 3 && s.tasksOverdue >= 2                                   ? 'tense'
    : stress >= 3 && s.chatCount7d === 0 && s.notesThisWeek < 3           ? 'frustrated'
    : stress >= 2                                                          ? 'worried'
    : s.chatCount7d === 0 && s.notesThisWeek === 0 && s.journalStreak === 0 && s.loginStreak < 3 ? 'sad'
    : s.chatCount7d === 0 && s.loginStreak > 1                            ? 'lonely'
    : s.daysSinceLastLogin >= 2                                            ? 'hungry'
    : s.notesThisWeek < 2 && s.chatTodayCount === 0 && s.tasksDue < 3
      && s.loginStreak >= 2 && !isEvening && !isMorning                   ? 'bored'
    : isMorning && s.loginStreak >= 5 && stress === 0                     ? 'sunlit'
    : highActivity && s.chatCount7d >= 5 && stress === 0                  ? 'excited'
    : s.journalStreak >= 3 && s.notesThisWeek >= 5 && s.tasksDue < 5     ? 'motivated'
    : s.chatTodayCount >= 8 || s.notesThisWeek >= 8                       ? 'grateful'
    : s.loginStreak >= 10                                                  ? 'devoted'
    : s.journalStreak >= 3 && s.tasksOverdue === 0 && s.loginStreak >= 3  ? 'proud'
    : s.tasksOverdue === 0 && s.loginStreak >= 5 && stress === 0          ? 'relieved'
    : s.chatCount7d >= 5 && s.loginStreak >= 5                            ? 'warm'
    : isMorning && s.chatTodayCount >= 2 && stress < 2                    ? 'playful'
    : s.notesThisWeek >= 5 && s.chatCount7d >= 2                          ? 'curious'
    : s.notesThisWeek >= 3 && s.chatTodayCount === 0                      ? 'focused'
    : (s.chatTodayCount >= 5 || s.notesThisWeek >= 7)                     ? 'alert'
    : stress === 1 && s.loginStreak >= 3                                   ? 'hopeful'
    : isEvening && s.loginStreak >= 5 && stress === 0                     ? 'cozy'
    : isNight && s.loginStreak >= 3 && stress < 2                         ? 'dreamy'
    : isEvening && s.notesThisWeek >= 5                                    ? 'nostalgic'
    : isEvening && s.loginStreak >= 3                                      ? 'reflective'
    : isEvening || (s.cetHour >= 16 && s.chatTodayCount === 0)            ? 'sleepy'
    : s.chatCount7d <= 1 && s.notesThisWeek >= 3 && stress < 2            ? 'pensive'
    : stress === 0 && s.tasksDue < 5 && s.loginStreak >= 3                ? 'serene'
    : stress === 0 && s.tasksDue < 3                                       ? 'gentle'
    : isMorning                                                            ? 'anticipating'
    : (s.notesThisWeek >= 2 || s.chatTodayCount >= 2)
      && s.loginStreak >= 2 && stress < 2                                  ? 'attentive'
    :                                                                        'content';

  const arc = A.find(a => a.name === name) ?? A[A.length - 1];
  const phrase = arc.phrases[Math.floor(Math.random() * arc.phrases.length)];
  return { archetype: arc.name, emotion: arc.name, visual: arc.visual, phrase };
}
