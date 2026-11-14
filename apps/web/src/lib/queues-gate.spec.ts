import { describe, expect, it } from 'vitest';
import { GATE_TTL_MS, signGate, verifyGate } from './queues-gate';

const SECRET = 'sk_test_example';
const NOW = 1_800_000_000_000;

describe('queues gate pass', () => {
  it('accepts a pass it signed until it expires', () => {
    const pass = signGate(NOW, SECRET)!;
    expect(verifyGate(pass, NOW, SECRET)).toBe(true);
    expect(verifyGate(pass, NOW + GATE_TTL_MS - 1, SECRET)).toBe(true);
    expect(verifyGate(pass, NOW + GATE_TTL_MS, SECRET)).toBe(false);
  });

  it('rejects a pass with a pushed-out expiry or a changed signature', () => {
    const [expires, sig] = signGate(NOW, SECRET)!.split('.');
    expect(verifyGate(`${Number(expires) + 1}.${sig}`, NOW, SECRET)).toBe(false);
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    expect(verifyGate(`${expires}.${flipped}`, NOW, SECRET)).toBe(false);
  });

  it('rejects a pass signed with another key', () => {
    expect(verifyGate(signGate(NOW, 'sk_test_other')!, NOW, SECRET)).toBe(false);
  });

  it('rejects malformed values', () => {
    for (const v of [undefined, '', 'x', '123', '123.', `abc.${'0'.repeat(64)}`, `123.${'0'.repeat(63)}`, `123.${'g'.repeat(64)}`]) {
      expect(verifyGate(v, NOW, SECRET)).toBe(false);
    }
  });

  it('has nothing to sign or check with when there is no secret', () => {
    expect(signGate(NOW, '')).toBeNull();
    expect(verifyGate(signGate(NOW, SECRET)!, NOW, '')).toBe(false);
  });
});
