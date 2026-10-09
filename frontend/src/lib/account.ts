// The mocked AWS account shown in the top bar. AWS accounts (and IAM) are out of
// scope, so each user gets a made-up but stable 12-digit account ID derived from
// their user id: same user, same ID, on every load and device.

/** 12 digits, like "255274109354". FNV-1a over the user id, so IDs look random. */
export function mockAccountId(userId: number): string {
  let hash = 0x811c9dc5;
  for (const char of `route53-clone-account-${userId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // 32 bits give 10 digits; a fixed 2-digit prefix (never a leading 0) makes 12.
  return `${10 + (userId % 90)}${String(hash).padStart(10, "0")}`;
}

/** The account menu's format: "2552-7410-9354". */
export function formatAccountId(accountId: string): string {
  return accountId.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3");
}
