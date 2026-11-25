export interface ClientPowChallenge {
  challengeId: string;
  prefix: string;
  difficulty: number;
  expiresAt: number;
  sig: string;
}

export interface ClientPowSubmission extends ClientPowChallenge {
  nonce: string;
}

function countLeadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) {
      bits += 8;
    } else {
      bits += Math.clz32(b) - 24;
      break;
    }
  }
  return bits;
}

async function solveOnWorker(
  prefix: string,
  difficulty: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/pow-worker.js");
    worker.onmessage = (event: MessageEvent<{ nonce: string }>) => {
      worker.terminate();
      resolve(event.data.nonce);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || "Browser security check failed"));
    };
    worker.postMessage({ prefix, difficulty });
  });
}

async function solveOnMainThreadFallback(
  prefix: string,
  difficulty: number
): Promise<string> {
  const encoder = new TextEncoder();
  let nonce = 0;
  while (true) {
    const candidate = nonce.toString(36);
    const data = encoder.encode(`${prefix}:${candidate}`);
    const digestBuf = await crypto.subtle.digest("SHA-256", data);
    const digest = new Uint8Array(digestBuf);
    if (countLeadingZeroBits(digest) >= difficulty) {
      return candidate;
    }
    nonce++;
    if (nonce % 500 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

export async function fetchAndSolvePow(): Promise<ClientPowSubmission> {
  const res = await fetch("/api/pow/challenge", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Couldn't start the quick spam check. Please try again.");
  }
  const challenge = (await res.json()) as ClientPowChallenge;

  let nonce: string;
  if (typeof Worker !== "undefined") {
    try {
      nonce = await solveOnWorker(challenge.prefix, challenge.difficulty);
    } catch {
      nonce = await solveOnMainThreadFallback(
        challenge.prefix,
        challenge.difficulty
      );
    }
  } else {
    nonce = await solveOnMainThreadFallback(
      challenge.prefix,
      challenge.difficulty
    );
  }

  return {
    ...challenge,
    nonce,
  };
}
