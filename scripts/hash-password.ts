import { hashPassword } from "../src/lib/crypto";

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error(
    'Usage: npm run hash-password -- "<your-strong-password-min-8-chars>"'
  );
  process.exit(1);
}

console.log(hashPassword(password));
