import { describe, expect, it } from 'vitest';
import type { NotifiablePosting } from './notifier';
import { buildMessage } from './slack.notifier';

const postings: NotifiablePosting[] = [
  {
    id: 1,
    source: 'WANTED',
    title: '<C++> & Node 개발자',
    company: 'A&B',
    location: '서울',
    url: 'https://example.com/1',
    dueDate: new Date('2026-11-30'),
  },
  { id: 2, source: 'SARAMIN', title: '백엔드', company: 'C사', location: null, dueDate: null, url: 'https://example.com/2' },
];

describe('buildMessage', () => {
  const msg = buildMessage(postings);
  const blocks = msg.blocks as { type: string; text: { text: string } }[];

  it('starts with a header naming the count and the sources', () => {
    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: '새 공고 2건 · 원티드, 사람인', emoji: true },
    });
  });

  it('renders one section per posting with a link, escaped mrkdwn and due date or 상시', () => {
    expect(blocks).toHaveLength(3);
    expect(blocks[1].text.text).toBe('*<https://example.com/1|&lt;C++&gt; &amp; Node 개발자>*\nA&amp;B · 서울 · ~2026-11-30');
    expect(blocks[2].text.text).toBe('*<https://example.com/2|백엔드>*\nC사 · 상시');
  });

  it('includes a plain-text fallback', () => {
    expect(msg.text).toBe('새 공고 2건 · 원티드, 사람인\n• A&B — <C++> & Node 개발자\n• C사 — 백엔드');
  });
});
