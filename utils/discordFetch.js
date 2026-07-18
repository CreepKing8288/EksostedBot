const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let globalQueue = [];
let processing = false;
const CONCURRENT_LIMIT = 2;
const MIN_DELAY_MS = 500;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (globalQueue.length > 0) {
    const batch = globalQueue.splice(0, CONCURRENT_LIMIT);
    await Promise.all(batch.map(({ fn, resolve, reject }) => fn().then(resolve).catch(reject)));
    if (globalQueue.length > 0) {
      await sleep(MIN_DELAY_MS);
    }
  }

  processing = false;
}

function enqueueRequest(fn) {
  return new Promise((resolve, reject) => {
    globalQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function discordFetch(url, options = {}, retries = 3) {
  const fn = async () => {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        const res = await fetch(url, options);

        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          const retryAfter = (body.retry_after || 2) * 1000;
          console.warn(`[RateLimit] Hit rate limit on ${url}. Retrying after ${retryAfter}ms...`);
          await sleep(retryAfter);
          attempt++;
          continue;
        }

        if (res.status >= 500 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[RateLimit] Server error ${res.status} on ${url}. Retrying after ${delay}ms...`);
          await sleep(delay);
          attempt++;
          continue;
        }

        return res;
      } catch (err) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
          attempt++;
          continue;
        }
        throw err;
      }
    }
  };

  return enqueueRequest(fn);
}

module.exports = { discordFetch, sleep, enqueueRequest };
