import { useMemo, useState, useEffect, useRef } from "react";
import { Coins, Stethoscope, Syringe, Footprints, Search, Plus, Pencil, X, MoreVertical, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { obtenerServicios, crearServicio, actualizarServicio, eliminarServicio } from "@/services/nocodb/servicios.service";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeServiceCount,
  runningAverageServicePrice,
  serviceCountsByCategoryTriplet,
} from "@/lib/metricSparklineSeries";
import { formatSoles } from "@/lib/currency";

type PodiatryService = {
  id: string;
  name: string;
  description: string;
  category: "consulta" | "quirurgico" | "ortesis";
  durationMin: number;
  pricePen: number;
};

const tabIcon = {
  consulta: Stethoscope,
  quirurgico: Syringe,
  ortesis: Footprints,
} as const;

const categoryLabels = { consulta: "Consultas", quirurgico: "Cirugía menor", ortesis: "Ortesis" } as const;

function newServiceId() {
  return `s-${Date.now()}`;
}

function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const endRef = useRef(end);
  const requestRef = useRef<number>();

  useEffect(() => {
    endRef.current = end;
    countRef.current = 0;
    setCount(0);

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeOutQuart
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentCount = Math.floor(easeOutQuart * endRef.current);
      countRef.current = currentCount;
      setCount(currentCount);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [end, duration]);

  return count;
}

export default function ServicesPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tab, setTab] = useState<string>("consulta");
  const [services, setServices] = useState<PodiatryService[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<PodiatryService["category"]>("consulta");
  const [formDuration, setFormDuration] = useState("");
  const [formPrice, setFormPrice] = useState("");

  const resetFormForAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormCategory(tab as PodiatryService["category"]);
    setFormDuration("45");
    setFormPrice("");
  };

  // Debounce para búsqueda
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(q);
    }, 500); // 500ms de debounce
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [q]);

  // Cargar servicios desde la API
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        
        // Mapear tab a tipoCatologo
        const tipoCatologoMap: Record<string, string> = {
          consulta: 'consulta',
          quirurgico: 'cirugiaMenor',
          ortesis: 'Ortesis'
        };
        
        const data = await obtenerServicios(tipoCatologoMap[tab], debouncedQ.trim() || undefined);
        const servicios = data.records || [];
        
        // Mapear datos de la API al formato de PodiatryService
        const mappedServices: PodiatryService[] = servicios
          .filter((s: any) => s.fields.servicio) // Filtrar registros sin servicio
          .map((s: any) => {
            // Convertir duración de HH:MM:SS a minutos
            const duracionParts = s.fields.duracion ? s.fields.duracion.split(':') : ['0', '30', '00'];
            const durationMin = parseInt(duracionParts[0]) * 60 + parseInt(duracionParts[1]);
            
            // Mapear tipoCatologo a category
            const tipoCatologo = s.fields.tipoCatologo || 'consulta';
            let category: PodiatryService["category"] = 'consulta';
            if (tipoCatologo === 'cirugiaMenor' || tipoCatologo === 'quirurgico') {
              category = 'quirurgico';
            } else if (tipoCatologo === 'Ortesis' || tipoCatologo === 'ortesis') {
              category = 'ortesis';
            }
            
            return {
              id: String(s.id),
              name: s.fields.servicio || '',
              description: s.fields.descripcion || '',
              category,
              durationMin,
              pricePen: s.fields.precio || 0
            };
          });
        
        setServices(mappedServices);
      } catch (err) {
        console.error("Error al cargar servicios:", err);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, [tab, debouncedQ]);

  const openAdd = () => {
    resetFormForAdd();
    setDialogOpen(true);
  };

  const openEdit = (s: PodiatryService) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormDescription(s.description);
    setFormCategory(s.category);
    setFormDuration(String(s.durationMin));
    setFormPrice(String(s.pricePen));
    setDialogOpen(true);
  };

  const totalPrice = services.reduce((acc, s) => acc + s.pricePen, 0);
  const totalDuration = services.reduce((acc, s) => acc + s.durationMin, 0);
  const totalDurationHours = Math.floor(totalDuration / 60);
  const totalDurationMins = totalDuration % 60;

  const animatedServicesCount = useCountUp(services.length, 800);
  const animatedTotalPrice = useCountUp(Math.round(totalPrice), 800);
  const animatedTotalDurationHours = useCountUp(totalDurationHours, 800);
  const animatedTotalDurationMins = useCountUp(totalDurationMins, 800);

  const servicesSparklines = useMemo(
    () => ({
      count: cumulativeServiceCount(services),
      avg: runningAverageServicePrice(services),
      categories: serviceCountsByCategoryTriplet(services),
    }),
    [services],
  );

  const handleSaveService = async () => {
    const name = formName.trim();
    const description = formDescription.trim();
    const durationMin = Number.parseInt(formDuration, 10);
    const pricePen = Number.parseFloat(formPrice.replace(",", "."));

    if (!name) {
      toast.error("Indica el nombre del servicio");
      return;
    }
    if (!Number.isFinite(durationMin) || durationMin < 5) {
      toast.error("Duración no válida (mín. 5 min)");
      return;
    }
    if (!Number.isFinite(pricePen) || pricePen < 0) {
      toast.error("Precio no válido");
      return;
    }

    // Convertir duración de minutos a HH:MM:SS
    const hours = Math.floor(durationMin / 60);
    const minutes = durationMin % 60;
    const duracion = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    // Mapear category a tipoCatologo
    const tipoCatologoMap: Record<PodiatryService["category"], string> = {
      consulta: 'consulta',
      quirurgico: 'cirugiaMenor',
      ortesis: 'Ortesis'
    };

    try {
      if (editingId) {
        await actualizarServicio(editingId, {
          servicio: name,
          tipoCatologo: tipoCatologoMap[formCategory],
          descripcion: description || "Sin descripción.",
          duracion,
          precio: pricePen
        });
        setServices((prev) =>
          prev.map((s) =>
            s.id === editingId ? { ...s, name, description, category: formCategory, durationMin, pricePen } : s,
          ),
        );
        toast.success("Servicio actualizado");
      } else {
        const result = await crearServicio({
          servicio: name,
          tipoCatologo: tipoCatologoMap[formCategory],
          descripcion: description || "Sin descripción.",
          duracion,
          precio: pricePen
        });
        setServices((prev) => [
          ...prev,
          {
            id: String(result.id),
            name,
            description: description || "Sin descripción.",
            category: formCategory,
            durationMin,
            pricePen,
          },
        ]);
        toast.success("Servicio añadido al catálogo");
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      toast.error("Error al guardar el servicio");
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await eliminarServicio(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success("Servicio eliminado del catálogo");
    } catch (err) {
      console.error("Error al eliminar servicio:", err);
      toast.error("Error al eliminar el servicio");
    }
  };

  // Mostrar indicador de carga inicial
  if (loading && services.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando servicios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Servicios y tarifas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prestaciones en domicilio del paciente: duración, precios orientativos (incl. desplazamiento en zona) y descripción
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-shadow border-primary/10">
          <CardContent className="flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Servicios activos</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{animatedServicesCount}</p>
            </div>
            <SparklineAreaAnimated
              values={servicesSparklines.count}
              delayMs={0}
              colorClassName="text-primary"
              className="shrink-0"
            />
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold mt-1 flex items-center gap-1.5 tabular-nums">
                <Coins className="h-5 w-5 shrink-0 text-primary" />
                {formatSoles(animatedTotalPrice)}
              </p>
            </div>
            <SparklineAreaAnimated
              values={servicesSparklines.avg}
              delayMs={85}
              colorClassName="text-primary"
              className="shrink-0"
            />
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duración total</p>
              <p className="text-2xl font-bold mt-1 flex items-center gap-1.5 tabular-nums">
                <Clock className="h-5 w-5 shrink-0 text-primary" />
                {animatedTotalDurationHours}h {animatedTotalDurationMins}min
              </p>
            </div>
            <SparklineAreaAnimated
              values={servicesSparklines.categories}
              delayMs={170}
              colorClassName="text-info"
              className="shrink-0"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Catálogo</CardTitle>
              <CardDescription>Filtra por tipo de actuación o busca por nombre</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar servicio..."
                  className="pl-9 bg-muted/40 border-0"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Button type="button" onClick={openAdd} className="shrink-0 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Agregar servicio
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/60">
              {(["consulta", "quirurgico", "ortesis"] as const).map((key) => {
                const Icon = tabIcon[key];
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2.5"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{categoryLabels[key]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {(["consulta", "quirurgico", "ortesis"] as const).map((key) => (
              <TabsContent key={key} value={key} className="mt-4 animate-fade-in">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px] [&_td]:py-1.5 [&_td]:px-2 [&_th]:py-2 [&_th]:px-2">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Servicio</TableHead>
                        <TableHead className="w-[100px]">Duración</TableHead>
                        <TableHead className="text-right w-[120px]">Precio</TableHead>
                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Buscando en el servidor...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : services.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No hay resultados en esta categoría
                        </TableCell>
                      </TableRow>
                    ) : (
                      services.map((s) => (
                        <TableRow key={s.id} className="group hover:bg-muted/30 h-[20px]">
                          <TableCell className="">
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{s.description}</p>
                          </TableCell>
                          <TableCell className="">
                            <Badge variant="outline" className="font-normal border-primary/20 text-primary">
                              {s.durationMin} min
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatSoles(s.pricePen)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Más opciones"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(s)}>
                                  Editar
                                </DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Eliminar
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará del catálogo el servicio <span className="font-medium text-foreground">{s.name}</span>.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleDeleteService(s.id)}
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="sm:max-w-xl overflow-hidden rounded-xl p-0" showCloseButton={false} showScrollContainer={false} showPadding={false}>
          {/* Header con degradado sutil */}
          <div className="relative px-6 pt-5 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, rgba(34, 180, 173, 0.05) 0%, white 50%)' }}>
            <DialogClose asChild>
              <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </DialogClose>
            <div className="flex items-start gap-3.5 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#e6f7f6' }}>
                <Stethoscope className="h-5 w-5" style={{ color: '#22b4ad' }} />
              </div>
              <div>
                <DialogTitle className="text-[18px] font-medium text-foreground">{editingId ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
                <p className="text-[13px] text-gray-500 mt-1">
                  {editingId ? "Modifica los datos del catálogo." : "Completa los campos para añadir una nueva prestación al catálogo."}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-6 sm:overflow-visible max-sm:overflow-y-auto max-sm:max-h-[calc(90vh-180px)]">
            {/* Sección Información del servicio */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Información del servicio</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Nombre del servicio</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Revisión post-operatoria"
                  className="text-sm"
                  style={{
                    backgroundColor: '#f5fffe',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: 'none'
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Descripción</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalle breve para el paciente o facturación"
                  className="text-sm"
                  style={{
                    backgroundColor: '#f5fffe',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: 'none'
                  }}
                />
              </div>
            </div>

            {/* Sección Categoría y tarifas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Categoría y tarifas</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Categoría</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as PodiatryService["category"])}>
                  <SelectTrigger className="text-sm" style={{ backgroundColor: '#f5fffe', border: 'none', borderRadius: '8px', boxShadow: 'none' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulta">{categoryLabels.consulta}</SelectItem>
                    <SelectItem value="quirurgico">{categoryLabels.quirurgico}</SelectItem>
                    <SelectItem value="ortesis">{categoryLabels.ortesis}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Duración (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    className="text-sm tabular-nums"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Precio (soles)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="text-sm tabular-nums"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0"
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="text-sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveService} className="text-sm" style={{ backgroundColor: '#22b4ad', color: 'white' }}>
              {editingId ? "Guardar cambios" : "Agregar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
