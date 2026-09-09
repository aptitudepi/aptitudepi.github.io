// js/fetch-timeout.js — timeout-capable fetch signals (Phase 5 fetch hardening).
//
// Every external fetch on the site funnels its AbortSignal through
// combinedTimeoutSignal(): the caller's runSignal (user Ctrl+C / command
// change) races a wall-clock timeout, so a hung endpoint degrades to the
// caller's existing next-action message instead of hanging the terminal.
// Prefers AbortSignal.timeout/any when present, with a manual
// AbortController fallback for older engines. Status checks stay with the
// callers (they own the degraded messages); this module only owns signals.

const DEFAULT_FETCH_TIMEOUT_MILLIS = 10000;
const AI_STREAM_TIMEOUT_MILLIS = 60000;
const SEARCH_TIMEOUT_MILLIS = 15000;

function asCleanSignal(candidateSignal) {
  if (!candidateSignal) return null;
  try {
    if (typeof AbortSignal !== `undefined` && candidateSignal instanceof AbortSignal) return candidateSignal;
  } catch (signalCheckError) {
    console.warn(`fetch timeout signal check skipped: ${signalCheckError.message}`);
  }
  return null;
}

// Race runSignal against a wall-clock timeout. Returns a usable signal, or
// the clean runSignal / null when neither timeout path is available.
function combinedTimeoutSignal(runSignal, timeoutMillis) {
  const parsedTimeout = Number(timeoutMillis);
  const safeTimeout = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_FETCH_TIMEOUT_MILLIS;
  const cleanSignal = asCleanSignal(runSignal);
  try {
    if (typeof AbortSignal !== `undefined` && typeof AbortSignal.timeout === `function`) {
      const timeoutSignal = AbortSignal.timeout(safeTimeout);
      if (cleanSignal && typeof AbortSignal.any === `function`) {
        return AbortSignal.any([cleanSignal, timeoutSignal]);
      }
      if (!cleanSignal) return timeoutSignal;
    }
  } catch (signalBuildError) {
    console.warn(`fetch timeout signal skipped: ${signalBuildError.message}`);
  }
  if (!cleanSignal) {
    try {
      if (typeof AbortSignal !== `undefined` && typeof AbortSignal.timeout === `function`) {
        return AbortSignal.timeout(safeTimeout);
      }
    } catch (timeoutOnlyError) {
      console.warn(`fetch timeout-only signal skipped: ${timeoutOnlyError.message}`);
    }
    return null;
  }
  // Manual fallback: mirror runSignal plus a setTimeout abort. The timer is
  // cleared as soon as either side settles so idle controllers never pile up.
  try {
    const fallbackController = new AbortController();
    const fallbackTimer = window.setTimeout(() => {
      try {
        fallbackController.abort(new DOMException(`Timed out`, `TimeoutError`));
      } catch (abortError) {
        console.warn(`fetch timeout abort skipped: ${abortError.message}`);
      }
    }, safeTimeout);
    fallbackController.signal.addEventListener(`abort`, () => {
      window.clearTimeout(fallbackTimer);
    }, { once: true });
    if (cleanSignal.aborted) {
      window.clearTimeout(fallbackTimer);
      fallbackController.abort(cleanSignal.reason);
    } else {
      cleanSignal.addEventListener(`abort`, () => {
        window.clearTimeout(fallbackTimer);
        try {
          fallbackController.abort(cleanSignal.reason);
        } catch (forwardError) {
          console.warn(`fetch abort forward skipped: ${forwardError.message}`);
        }
      }, { once: true });
    }
    return fallbackController.signal;
  } catch (fallbackError) {
    console.warn(`fetch manual timeout skipped: ${fallbackError.message}`);
    return cleanSignal;
  }
}

export { combinedTimeoutSignal, DEFAULT_FETCH_TIMEOUT_MILLIS, AI_STREAM_TIMEOUT_MILLIS, SEARCH_TIMEOUT_MILLIS };
