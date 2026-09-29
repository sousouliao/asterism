import { describe, expect, it } from 'vitest';
import { useBulkSelectionStore } from './bulk-selection';

describe('useBulkSelectionStore', () => {
  it('toggles bulk selection active state', () => {
    expect(useBulkSelectionStore.getState().active).toBe(false);
    useBulkSelectionStore.getState().setActive(true);
    expect(useBulkSelectionStore.getState().active).toBe(true);
    useBulkSelectionStore.getState().setActive(false);
    expect(useBulkSelectionStore.getState().active).toBe(false);
  });
});
