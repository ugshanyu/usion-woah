import { describe, expect, it } from 'vitest';
import type { Landmark } from '../game/types';
import { classifyPointingPose } from './pose-classifier';

function basePose(): Landmark[] {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
  landmarks[11] = { x: 0.35, y: 0.4, z: 0, visibility: 1 };
  landmarks[12] = { x: 0.65, y: 0.4, z: 0, visibility: 1 };
  landmarks[23] = { x: 0.4, y: 0.72, z: 0, visibility: 1 };
  landmarks[24] = { x: 0.6, y: 0.72, z: 0, visibility: 1 };
  return landmarks;
}

function point(direction: 'left' | 'right' | 'up' | 'down', bent = false): Landmark[] {
  const landmarks = basePose();
  const useRightArm = direction === 'right' || direction === 'up';
  const indices = useRightArm ? [12, 14, 16, 20] : [11, 13, 15, 19];
  const shoulder = landmarks[indices[0]];
  const endpoint = direction === 'right' ? { x: 0.97, y: 0.4 }
    : direction === 'left' ? { x: 0.03, y: 0.4 }
      : direction === 'up' ? { x: shoulder.x, y: 0.07 }
        : { x: shoulder.x, y: 0.83 };
  landmarks[indices[1]] = bent ? { x: shoulder.x + 0.18, y: shoulder.y + 0.12, z: 0, visibility: 1 } : { x: (shoulder.x + endpoint.x) / 2, y: (shoulder.y + endpoint.y) / 2, z: 0, visibility: 1 };
  landmarks[indices[2]] = { ...endpoint, z: 0, visibility: 1 };
  landmarks[indices[3]] = { ...endpoint, z: 0, visibility: 1 };
  return landmarks;
}

describe('classifyPointingPose', () => {
  for (const direction of ['left', 'right', 'up', 'down'] as const) {
    it(`recognizes ${direction} in the player's body coordinate system`, () => {
      const result = classifyPointingPose(point(direction));
      expect(result.direction).toBe(direction);
      expect(result.confidence).toBeGreaterThan(0.65);
    });
  }

  it('returns neutral when a visible body is not pointing', () => {
    expect(classifyPointingPose(basePose()).direction).toBe('neutral');
  });

  it('rejects a bent arm and low quality landmarks', () => {
    expect(classifyPointingPose(point('right', true)).direction).not.toBe('right');
    const low = point('right');
    low[14].visibility = 0.2;
    expect(classifyPointingPose(low).direction).not.toBe('right');
  });

  it('is invariant to translation and scale', () => {
    const transformed = point('up').map((landmark) => ({ ...landmark, x: 0.1 + landmark.x * 0.75, y: 0.12 + landmark.y * 0.75 }));
    expect(classifyPointingPose(transformed).direction).toBe('up');
  });

  it('is invariant to moderate camera roll in the torso coordinate system', () => {
    const angle = 15 * Math.PI / 180;
    const rotated = point('up').map((landmark) => {
      const x = landmark.x - 0.5;
      const y = landmark.y - 0.5;
      return { ...landmark, x: 0.5 + x * Math.cos(angle) - y * Math.sin(angle), y: 0.5 + x * Math.sin(angle) + y * Math.cos(angle) };
    });
    expect(classifyPointingPose(rotated).direction).toBe('up');
  });

  it('rejects equally strong conflicting arms', () => {
    const conflicting = point('right');
    const left = point('left');
    for (const index of [11, 13, 15, 19]) conflicting[index] = left[index];
    expect(classifyPointingPose(conflicting).direction).toBe('unknown');
  });
});
