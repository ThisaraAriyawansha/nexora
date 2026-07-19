import { LucideIcon, ShieldCheck } from "lucide-react";

export default function AccessRestricted({
  message,
  icon: Icon = ShieldCheck,
}: {
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="p-4 sm:p-8">
      <div className="nexora-card p-8 text-center max-w-md mx-auto">
        <Icon size={24} className="text-zinc-300 mx-auto mb-3" />
        <h1 className="font-prata text-lg text-black mb-1">Access Restricted</h1>
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
