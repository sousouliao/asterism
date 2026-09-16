import { Button } from '@asterism/ui';

export function App() {
  return (
    <div className="flex min-w-64 flex-col gap-3 bg-background p-4 text-foreground">
      <h1 className="font-semibold text-lg">Asterism</h1>
      <p className="text-muted-foreground text-sm">Personal open-source memory</p>
      <Button size="sm">Open Asterism</Button>
    </div>
  );
}
