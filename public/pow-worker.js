function countLeadingZeroBits(bytes) {
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

self.onmessage = async (event) => {
  const { prefix, difficulty } = event.data;
  const encoder = new TextEncoder();
  let nonce = 0;

  while (true) {
    const candidate = nonce.toString(36);
    const data = encoder.encode(`${prefix}:${candidate}`);
    const digestBuf = await self.crypto.subtle.digest("SHA-256", data);
    const digest = new Uint8Array(digestBuf);
    if (countLeadingZeroBits(digest) >= difficulty) {
      self.postMessage({ nonce: candidate });
      return;
    }
    nonce++;
  }
};
