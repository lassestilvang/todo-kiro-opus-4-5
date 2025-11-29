'use client';

import { AppLayout } from '@/components/layout';

export default function TodayPage() {
  return (
    <AppLayout title="Today">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Today</h1>
        </div>
        <p className="text-muted-foreground">
          Tasks scheduled for today will appear here.
        </p>
      </div>
    </AppLayout>
  );
}
