import { parseLetters } from '../api';

describe('parseLetters', () => {
  it('灯りの段階は 0〜4 に収める', () => {
    const r = parseLetters({
      day_key: '2026-11-19',
      is_full: true,
      completed: false,
      letters: [
        { slot: 1, answer_id: 'a', body: 'x', light_level: 9, my_reactions: [], seen: false },
        {
          slot: 2,
          answer_id: 'b',
          body: 'y',
          light_level: -1,
          my_reactions: ['wakaru'],
          seen: true,
        },
      ],
    });
    expect(r.letters.map((l) => l.lightLevel)).toEqual([4, 0]);
    expect(r.letters[1]?.myReactions).toEqual(['wakaru']);
  });
});
