import { createFileRoute } from "@tanstack/react-router";
import { ParticipationPanel } from "@/components/participation-panel";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_app/positive")({ component: FollowupPage });

function FollowupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-emerald-500" /> متابعة الطلاب
        </h1>
        <p className="text-muted-foreground mt-1">
          متابعة شهرية للمشاركة وحل الواجبات وإحضار الأدوات والالتزام والسلوك — لكل معلم شعبه المسندة له
        </p>
      </div>
      <ParticipationPanel />
    </div>
  );
}
