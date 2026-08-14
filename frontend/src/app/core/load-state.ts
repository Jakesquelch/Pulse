/**
 * Where a feature's initial GET has got to.
 *
 * A three-state union rather than two booleans, so "loading and failed at the
 * same time" can't be represented — the states are genuinely exclusive, and
 * the type says so.
 *
 * It lives in core/ rather than in one feature's model file because every
 * backend-backed feature has exactly this question to answer, and the answer
 * is never feature-specific. Same reasoning as ServerErrorBanner next door.
 */
export type LoadState = 'loading' | 'ready' | 'failed';
