import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// A buyer answer can be laid out as a list on the page (src/components/BuyerFaq.astro), while the FAQPage,
// llms.txt and facts.json keep the full `answer`. The list must quote the answer, so the two cannot drift.
type AnswerList = { lead: string; items: string[]; after?: string };
type Answer = { id: string; answer: string; answerList?: AnswerList };
const data = JSON.parse(await readFile('src/data/buyer-answers.json', 'utf8')) as { answers: Answer[]; standing: Answer[] };
const listed = [...data.answers, ...data.standing].filter((item) => item.answerList);

test('the all-hotels answer is laid out as a list', () => {
  const hotels = listed.find((item) => item.id === 'f-b1');
  assert.ok(hotels, 'f-b1 has an answerList');
  assert.equal(hotels.answerList!.items.length, 20, 'the twenty hotels with years or scope');
});

for (const item of listed) {
  test(`${item.id}: every part of the list is word for word from the answer, in order, and nothing else is left out`, () => {
    const list = item.answerList!;
    const parts = [list.lead, ...list.items, ...(list.after ? [list.after] : [])];
    let from = 0;
    let rest = '';
    for (const part of parts) {
      assert.ok(part.trim().length > 0, `${item.id}: an empty list part`);
      assert.ok(item.answer.includes(part), `${item.id}: not in the answer: "${part}"`);
      const at = item.answer.indexOf(part, from);
      assert.ok(at >= 0, `${item.id}: out of order: "${part}"`);
      rest += item.answer.slice(from, at);
      from = at + part.length;
    }
    rest += item.answer.slice(from);
    // Only the joins between the parts may stay behind: spaces, punctuation and a closing "and".
    assert.match(rest.replace(/\band\b/g, ''), /^[\s;:,.]*$/, `${item.id}: answer text missing from the list: "${rest.trim()}"`);
  });
}
