import { useState, useEffect } from "react";
import { FileText, Download, Shield, Stethoscope, FileSpreadsheet, Globe, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentTemplates } from "@/data/mockData";
import { toast } from "sonner";
import { WebsiteTemplateEditor } from "@/components/WebsiteTemplateEditor";

const typeIcon = (type: string) => {
  if (type === "Legal") return Shield;
  if (type === "Clínico") return Stethoscope;
  if (type === "Interconsulta") return FileSpreadsheet;
  return FileText;
};

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Mostrar indicador de carga inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando documentación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plantillas clínicas y personalización de la página web pública (textos, imágenes y contacto)
        </p>
      </div>

      <Tabs defaultValue="clinical" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="clinical" className="gap-2">
            <FileText className="h-4 w-4" />
            Plantillas clínicas
          </TabsTrigger>
          <TabsTrigger value="website" className="gap-2">
            <Globe className="h-4 w-4" />
            Plantilla web
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinical" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            {documentTemplates.map((doc) => {
              const Icon = typeIcon(doc.type);
              return (
                <Card key={doc.id} className="card-shadow group border-primary/5 hover:border-primary/20 transition-colors">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-snug">{doc.title}</CardTitle>
                      <CardDescription>Actualizado el {doc.updatedAt}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <Badge variant="outline" className="border-primary/25 text-primary font-normal">
                      {doc.type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled
                    >
                      <Download className="h-3.5 w-3.5" />
                      Próximamente
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="website" className="mt-0">
          <WebsiteTemplateEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
