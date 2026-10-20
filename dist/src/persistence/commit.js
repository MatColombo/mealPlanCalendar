import { cloneStateSnapshot } from '../data/state.js';

/**
 * Return a candidate for display only after its repository transaction commits.
 * Usage: model.state = await commitCandidate(repository, nextState, options).
 * A rejected save leaves model.state at the caller's previous committed state.
 * The returned snapshot is isolated from the caller's input and storage copy.
 */
export async function commitCandidate(repository, candidate, options) {
  const next = cloneStateSnapshot(candidate);
  await repository.save(next, options);
  return next;
}
