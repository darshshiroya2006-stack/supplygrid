import { useGetRecentActivity } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingCart, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function AdminRecentActivity() {
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity();

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Recent Activity</h1>
        <p className="text-muted-foreground mt-1">Operational activity feed of orders and inquiries</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Latest system transactions and customer inquiries</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-6">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className={`mt-0.5 p-2 rounded-full ${activity.type === "order" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                    {activity.type === "order" ? <ShoppingCart className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{activity.subtitle}</p>
                    {activity.amount && (
                      <p className="text-sm font-bold text-foreground mt-1">₹{activity.amount.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No recent activity</div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
