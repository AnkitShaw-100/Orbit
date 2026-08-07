import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Theme() {
  return (
    <div className="min-h-screen bg-background p-10">
      <h1 className="text-4xl font-bold mb-8">Shadcn Theme Showcase</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>

        <CardContent className="flex gap-4">
          <Button>Default</Button>

          <Button variant="outline">
            Outline
          </Button>

          <Button variant="destructive">
            Destructive
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}