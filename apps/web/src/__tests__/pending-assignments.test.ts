import { beforeEach, describe, expect, it } from 'vitest';
import { addPendingAssignment, loadPendingAssignments, removePendingAssignment } from '../lib/pending-assignments';

const EVENT = 'demo-event';
const TEAM = 'team-alpha';

describe('pending assignments (gap A4 banner persistence)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(loadPendingAssignments(EVENT, TEAM)).toEqual([]);
  });

  it('adds a patient id and it survives a reload (a fresh load call)', () => {
    addPendingAssignment(EVENT, TEAM, 'pat-1');
    // Simulate a reload: nothing in memory, read straight from storage.
    expect(loadPendingAssignments(EVENT, TEAM)).toEqual(['pat-1']);
  });

  it('does not duplicate an id that is already pending', () => {
    addPendingAssignment(EVENT, TEAM, 'pat-1');
    addPendingAssignment(EVENT, TEAM, 'pat-1');
    expect(loadPendingAssignments(EVENT, TEAM)).toEqual(['pat-1']);
  });

  it('removes an id once the patrol answers, and only that id', () => {
    addPendingAssignment(EVENT, TEAM, 'pat-1');
    addPendingAssignment(EVENT, TEAM, 'pat-2');
    removePendingAssignment(EVENT, TEAM, 'pat-1');
    expect(loadPendingAssignments(EVENT, TEAM)).toEqual(['pat-2']);
  });

  it('keeps ids scoped per event and per team', () => {
    addPendingAssignment(EVENT, TEAM, 'pat-1');
    addPendingAssignment(EVENT, 'team-bravo', 'pat-2');
    addPendingAssignment('other-event', TEAM, 'pat-3');
    expect(loadPendingAssignments(EVENT, TEAM)).toEqual(['pat-1']);
    expect(loadPendingAssignments(EVENT, 'team-bravo')).toEqual(['pat-2']);
    expect(loadPendingAssignments('other-event', TEAM)).toEqual(['pat-3']);
  });

  it('never throws when localStorage access fails', () => {
    const original = globalThis.localStorage.getItem;
    globalThis.localStorage.getItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(loadPendingAssignments(EVENT, TEAM)).toEqual([]);
    } finally {
      globalThis.localStorage.getItem = original;
    }
  });
});
