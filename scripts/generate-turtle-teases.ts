/**
 * One-off generator for SPLINTER_INTRUDER_QUOTES (turtle break-in teases).
 * Run: npx tsx scripts/generate-turtle-teases.ts > src/splinter/turtle-teases.ts
 */
const openings = [
  'young turtle',
  'little turtle',
  'bold turtle',
  'restless turtle',
  'curious turtle',
  'stubborn turtle',
  'eager turtle',
  'sneaky turtle',
  'determined turtle',
  'impatient turtle',
];

const actions = [
  'scratch at the inner door',
  'rattle the gate to Master Splinter',
  'poke /master-splinter again',
  'try to slip past Master Splinter',
  'storm the maintainer\'s chamber',
  'tap the forbidden command',
  'challenge the locked dojo',
  'test the admin seal',
  'knock on Splinter\'s private screen',
  'reach for the cloud agent',
];

const outcomes = [
  'The dojo does not open for tourists.',
  'Master Splinter sips tea. You get /report.',
  'Master Splinter belongs to one keeper, not the sewer.',
  'The rat has seen this {count} times today.',
  'Still no clearance — only character growth.',
  'The shell is strong; your permissions are not.',
  'Another lesson in humility, served warm.',
  'The inner room stays inner.',
  'You may train at /bug. You may not command.',
  'Splinter is flattered. Splinter still says no.',
];

const extras = [
  'File the bug, not the breaker switch.',
  'Your path is /report, little one.',
  'Return to the courtyard of /bug.',
  'Evidence before empire, always.',
  'The wise turtle files; the loud turtle is turned away.',
];

const quotes = new Set<string>();

for (const o of openings) {
  for (const a of actions) {
    for (const out of outcomes) {
      if (quotes.size >= 100) break;
      const ex = extras[quotes.size % extras.length];
      quotes.add(
        `{who}, ${o}, you ${a} — attempt {count}. ${out} ${ex}`,
      );
    }
    if (quotes.size >= 100) break;
  }
  if (quotes.size >= 100) break;
}

// Hand-crafted anchors for tone (replace some generic ones)
const handcrafted: string[] = [
  '{who}, young turtle on attempt {count}: you cannot break Master Splinter. You can break your habit of skipping /report.',
  '{who}, the sewer is full of turtles who wanted Master Splinter. They got /bug homework instead.',
  '{who}, strike {count} if you must. The door laughs quietly. Splinter does not.',
  '{who}, you hunt the admin\'s agent like pizza. Master Splinter hunts discipline in you.',
  '{who}, attempt {count} to "hack" the dojo with /master-splinter. The only hack today is a good /report.',
  '{who}, little shell, big dreams. Dreams start with /bug, not forbidden commands.',
  '{who}, Splinter gave the keeper a choice. You get attempt {count} and a redirect to /report.',
  '{who}, even Michelangelo waited. You did not wait. Attempt {count} denied.',
  '{who}, you are not breaking Splinter. You are building a very funny personal scoreboard: {count}.',
  '{who}, young turtle energy is sacred. Misdirected turtle energy hits /master-splinter and bounces.',
  '{who}, the sensei chamber is not a group chat. Train publicly with /report.',
  '{who}, attempt {count}: still a turtle, still not admin, still welcome at /bug.',
  '{who}, Master Splinter has notes on you. Note one: use /report. Note two: stop this.',
  '{who}, you cannot ninja-roll past permissions. Roll to /report instead.',
  '{who}, the cloud is upstairs. You are downstairs. Attempt {count} does not install stairs.',
  '{who}, young turtle, your persistence is art. Your clearance is unchanged.',
  '{who}, if Master Splinter were pizza, you would still need admin keys. You have /bug.',
  '{who}, attempt {count} on the forbidden bell. The bell rings "file a report."',
  '{who}, Splinter respects the try. Splinter denies the tool. /report, turtle.',
  '{who}, you are speed-running rejection. Speed-run /report instead — PB awaits.',
];

for (const h of handcrafted) {
  if (quotes.size >= 100) break;
  quotes.add(h);
}

const list = [...quotes].slice(0, 100);

console.log('// turtle teases: 100 — young turtles attempting the locked dojo\n');
console.log('export const TURTLE_INTRUDER_TEASES = [');
for (const q of list) {
  console.log(`  '${q.replace(/'/g, "\\'")}',`);
}
console.log('] as const;\n');
