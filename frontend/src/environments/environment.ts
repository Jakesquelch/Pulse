/**
 * Settings that depend on *where* the app is running rather than what it does.
 *
 * Same idea as the old STORAGE_KEY seam: one file knows the value, everything
 * else asks. Before this existed, `http://localhost:8000` was written out in
 * three services and two templates, so moving the API meant finding all five.
 *
 * There's deliberately only one of these. Angular's usual setup pairs it with
 * an `environment.production.ts` swapped in at build time via `fileReplacements`
 * in angular.json — but Pulse isn't deployed anywhere, so a second file would
 * only contain a URL nobody has chosen. When deployment happens, add the file,
 * add fileReplacements to the production configuration, and nothing that reads
 * `environment` below has to change. That's the point of the seam.
 */
export const environment = {
  /** Base URL of the Pulse API — no trailing slash; callers add the path. */
  apiUrl: 'http://localhost:8000',
};
