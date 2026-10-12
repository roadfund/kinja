import { avatarUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

// A person's uploaded photo, or a DiceBear toon head when they have none.
export function Avatar({ photoUrl, seed, name, className }: { photoUrl?: string; seed: string; name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- data URLs and DiceBear SVGs gain nothing from next/image
  return <img alt={`Photo of ${name}`} className={cn("h-9 w-9 shrink-0 rounded-full bg-[#e7eee4] object-cover", className)} src={photoUrl ?? avatarUrl(seed)} />;
}
