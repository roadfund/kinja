import { loadAccount, type Account } from "@/auth/server-store";
import { getRepository } from "@/repositories/server";

// Loads a seeded account by its demo username (see src/dev/seed.ts).
export async function seededAccount(username: string): Promise<Account> {
  const user = (await getRepository().list("User")).find((item) => item.username === username);
  if (!user) throw new Error(`No seeded user ${username}`);
  return (await loadAccount(user.id))!;
}
