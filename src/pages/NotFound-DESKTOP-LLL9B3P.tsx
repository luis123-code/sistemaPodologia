import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Footprints, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 px-4">
      <Card className="max-w-md w-full border-none shadow-2xl">
        <CardContent className="p-8 text-center space-y-6">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <div className="absolute h-28 w-28 rounded-full bg-primary/5 animate-ping" />
            <Footprints className="relative h-12 w-12 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-7xl font-extrabold tracking-tight text-primary">404</h1>
            <h2 className="text-2xl font-semibold text-foreground">Página no encontrada</h2>
            <p className="text-muted-foreground">
              La ruta <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-medium">{location.pathname}</code> no existe en FootCare.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="default" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Ir atrás
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Si crees que esto es un error, contacta al administrador del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
