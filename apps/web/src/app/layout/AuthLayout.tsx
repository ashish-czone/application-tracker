import { Outlet } from 'react-router';
import { Card, CardContent } from '@packages/ui';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <Outlet />
        </CardContent>
      </Card>
    </div>
  );
}
