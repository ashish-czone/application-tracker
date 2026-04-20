export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been removed.
        </p>
      </div>
    </main>
  );
}
