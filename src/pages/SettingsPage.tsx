import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
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
          <p className="text-muted-foreground animate-pulse font-medium">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Servicio a domicilio: datos del negocio, franjas y preferencias</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Negocio</TabsTrigger>
          <TabsTrigger value="schedule">Horarios</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="preferences">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-4">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-base">Datos del servicio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2"><Label>Nombre comercial</Label><Input defaultValue="FootCare — Podología a domicilio" /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid w-full min-w-0 gap-2"><Label>Teléfono citas</Label><Input defaultValue="+34 912 345 678" /></div>
                <div className="grid w-full min-w-0 gap-2"><Label>Email</Label><Input defaultValue="info@footcare.es" /></div>
              </div>
              <div className="grid gap-2"><Label>Base / oficina (facturación y logística)</Label><Input defaultValue="Calle de la Salud 15, 28001 Madrid" /></div>
              <Button onClick={() => toast.success("Datos guardados")}>Guardar cambios</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-base">Franjas de visita a domicilio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <span className="w-24 text-sm font-medium">{day}</span>
                  <Input className="w-24" defaultValue="09:00" type="time" />
                  <span className="text-muted-foreground">a</span>
                  <Input className="w-24" defaultValue="18:00" type="time" />
                </div>
              ))}
              <Separator />
              <div className="flex items-center gap-4">
                <span className="w-24 text-sm font-medium">Sábado</span>
                <Input className="w-24" defaultValue="09:00" type="time" />
                <span className="text-muted-foreground">a</span>
                <Input className="w-24" defaultValue="14:00" type="time" />
              </div>
              <Button onClick={() => toast.success("Horarios actualizados")}>Guardar horarios</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-base">Gestión de Usuarios</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Dr. Ramírez", role: "Administrador", email: "dr.ramirez@footcare.es" },
                  { name: "Laura Asistente", role: "Recepción", email: "laura@footcare.es" },
                ].map((u) => (
                  <div key={u.email} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">{u.role}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-4">+ Añadir usuario</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-base">Preferencias</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Notificaciones por email", desc: "Recibir alertas de visitas y ruta por correo" },
                { label: "Recordatorios SMS", desc: "Enviar SMS antes de la visita a domicilio" },
                { label: "Backup automático", desc: "Copia de seguridad diaria de datos" },
              ].map((pref) => (
                <div key={pref.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
              <Separator />
              <Button onClick={() => toast.success("Preferencias guardadas")}>Guardar preferencias</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
