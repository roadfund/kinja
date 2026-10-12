import { AppFrame } from "@/app/app-frame";

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppFrame>{children}</AppFrame>;
}
