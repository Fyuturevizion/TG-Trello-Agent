import { SPLINTER_WORKING_QUOTES } from './quotes-data';
import { createQuotePicker } from './quote-picker';

// meditation / reasoning, shown while Master Splinter works (not raw model thinking)
export const SPLINTER_MEDITATION_QUOTES = [
  'I still my mind before I touch the codebase.',
  'Breathe in clarity. Breathe out assumptions.',
  'The answer often arrives when the hands stop rushing.',
  'In meditation I see which file truly needs the strike.',
  'Empty the cup of yesterday’s deploy anxiety.',
  'The kata of code is repetition with intention.',
  'I sit with the bug until it confesses its origin.',
  'Silence is not idle, it is listening.',
  'The scroll unfolds in the mind before the editor.',
  'Patience is the first dependency.',
  'I honor the webhook with a calm spirit.',
  'The dojo is quiet; the diff will be small.',
  'Tea cools. Thoughts sharpen.',
  'One does not chase errors, one meets them with respect.',
  'The breath steadies; the branch name can wait.',
  'I meditate on the user’s true need, not their first words.',
  'The path of least surprise is walked slowly.',
  'In stillness I choose which test must exist.',
  'The rat’s ears hear what the logs whisper.',
  'I contemplate the form before the field.',
  'A restless mind writes restless code. I breathe.',
  'The art of triage is the art of attention.',
  'I walk the garden of functions in my head.',
  'Discipline in thought precedes discipline in merge.',
  'The incense of focus burns away scope creep.',
  'I bow to the requirement, then I act.',
  'The river of state flows best when unobstructed.',
  'Meditation reveals which line is decoration.',
  'I hold the PR in mind before the keyboard.',
  'The student waits; the sensei reads the architecture.',
  'Stillness teaches where the handler should live.',
  'I count ten breaths, then I count the edge cases.',
  'The mind is a dojo; clutter is the enemy.',
  'I visualize the card’s journey from tap to Trello.',
  'Wisdom is deleting what does not serve QA.',
  'The moon does not hurry the tide. I do not hurry the patch.',
  'I sit. I see the race condition in the mist.',
  'The body is still; the review is thorough.',
  'Every bug was once a thought left unexamined.',
  'I meditate on failure modes with compassion.',
  'The breath between read and write is sacred.',
  'I seek the simple kata, not the flashy throw.',
  'In quiet I hear the channel’s true voice.',
  'The apprentice’s question deserves a settled mind.',
  'I align intention with implementation.',
  'The fog lifts when you stop thrashing the branch.',
  'I practice the art of leaving good comments.',
  'The spine straight; the logic straighter.',
  'Meditation is reading code without ego.',
  'I let the wrong solution pass like a leaf on water.',
  'The dojo floor is level when the types align.',
  'I contemplate initData as one contemplates a seal.',
  'The heart rate falls; the insight rises.',
  'I am present with the Mini App’s soul.',
  'The old masters debugged with paper. I debug with peace.',
  'I inhale the spec. I exhale the guesswork.',
  'The wheel of CI turns; I do not spin with it.',
  'In meditation I forgive the messy handler, then I fix it.',
  'The strike lands where meditation pointed.',
  'I return from stillness with the change in hand.',
  'The work is done inwardly before it is done in git.',
  'I open my eyes. The path is clear.',
] as const;

const PRESENCE_QUOTE_POOL: readonly string[] = [
  ...SPLINTER_MEDITATION_QUOTES,
  ...SPLINTER_WORKING_QUOTES,
];

const pickPresenceQuote = createQuotePicker(PRESENCE_QUOTE_POOL);

export function nextMeditationQuote(avoid?: string): string {
  return pickPresenceQuote(avoid);
}
