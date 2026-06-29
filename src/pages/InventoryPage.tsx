import { useMemo, useState, useEffect, useRef } from "react";
import { AlertTriangle, Package, Search, Warehouse, Plus, Pencil, X, MoreVertical, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { inventoryItems as initialInventory, type InventoryItem } from "@/data/mockData";
import { obtenerInventario, crearInventario, actualizarInventario, eliminarInventario } from "@/services/nocodb/inventario.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeLowStockAlertsInListOrder,
  cumulativeSkuCount,
  cumulativeUnitsInListOrder,
} from "@/lib/metricSparklineSeries";

function newInventoryId() {
  return `i-${Date.now()}`;
}

function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    'Quirúrgico': 'bg-rose-100 text-rose-700 border-rose-200',
    'Higiene': 'bg-blue-100 text-blue-700 border-blue-200',
    'Ortesis': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Consumibles': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Equipo móvil': 'bg-teal-100 text-teal-700 border-teal-200',
    'Farmacia': 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return categoryColors[category] || 'bg-slate-100 text-slate-700 border-slate-200';
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

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formUnits, setFormUnits] = useState("");
  const [formMinUnits, setFormMinUnits] = useState("");
  const [formUnit, setFormUnit] = useState("uds.");

  
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); 
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  
  useEffect(() => {
    const loadInventory = async () => {
      try {
        setLoading(true);
        const data = await obtenerInventario(debouncedSearch.trim() || undefined);
        const inventario = data.records || [];
        
        
        const mappedItems: InventoryItem[] = inventario
          .filter((i: any) => i.fields.articulo) 
          .map((i: any) => ({
            id: String(i.id),
            name: i.fields.articulo || '',
            sku: i.fields.sku || '',
            category: i.fields.Categoria || '',
            units: i.fields.Actual || 0,
            minUnits: i.fields.Minimo || 0,
            unit: i.fields.unidad || 'uds.'
          }));
        
        setItems(mappedItems);
      } catch (err) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    loadInventory();
  }, [debouncedSearch]);

  const lowStock = items.filter((i) => i.units <= i.minUnits);
  const totalSkus = items.length;
  const totalUnits = items.reduce((a, i) => a + i.units, 0);

  const animatedTotalSkus = useCountUp(totalSkus, 800);
  const animatedTotalUnits = useCountUp(totalUnits, 800);
  const animatedLowStock = useCountUp(lowStock.length, 800);

  const inventorySparklines = useMemo(
    () => ({
      skus: cumulativeSkuCount(items),
      units: cumulativeUnitsInListOrder(items),
      alerts: cumulativeLowStockAlertsInListOrder(items),
    }),
    [items],
  );

  const openAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormSku("");
    setFormCategory("");
    setFormUnits("0");
    setFormMinUnits("10");
    setFormUnit("uds.");
    setDialogOpen(true);
  };

  const openEdit = (i: InventoryItem) => {
    setEditingId(i.id);
    setFormName(i.name);
    setFormSku(i.sku);
    setFormCategory(i.category);
    setFormUnits(String(i.units));
    setFormMinUnits(String(i.minUnits));
    setFormUnit(i.unit);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    const sku = formSku.trim().toUpperCase();
    const category = formCategory.trim();
    const units = Number.parseInt(formUnits, 10);
    const minUnits = Number.parseInt(formMinUnits, 10);
    const unit = formUnit.trim() || "uds.";

    if (!name) {
      toast.error("Indica el nombre del artículo");
      return;
    }
    if (!sku) {
      toast.error("Indica el SKU");
      return;
    }
    if (!category) {
      toast.error("Indica la categoría");
      return;
    }
    if (!Number.isFinite(units) || units < 0) {
      toast.error("Cantidad en stock no válida");
      return;
    }
    if (!Number.isFinite(minUnits) || minUnits < 0) {
      toast.error("Stock mínimo no válido");
      return;
    }

    try {
      if (editingId) {
        await actualizarInventario(editingId, {
          articulo: name,
          sku,
          Categoria: category,
          Actual: units,
          Minimo: minUnits,
          unidad: unit
        });
        toast.success("Artículo actualizado");
      } else {
        await crearInventario({
          articulo: name,
          sku,
          Categoria: category,
          Actual: units,
          Minimo: minUnits,
          unidad: unit
        });
        toast.success("Artículo añadido al inventario");
      }
      setDialogOpen(false);
      setEditingId(null);
      
      const data = await obtenerInventario(debouncedSearch.trim() || undefined);
      const inventario = data.records || [];
      const mappedItems: InventoryItem[] = inventario
        .filter((i: any) => i.fields.articulo)
        .map((i: any) => ({
          id: String(i.id),
          name: i.fields.articulo || '',
          sku: i.fields.sku || '',
          category: i.fields.Categoria || '',
          units: i.fields.Actual || 0,
          minUnits: i.fields.Minimo || 0,
          unit: i.fields.unidad || 'uds.'
        }));
      setItems(mappedItems);
    } catch (err) {
      toast.error("Error al guardar el artículo");
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await eliminarInventario(id);
      toast.success("Artículo eliminado del inventario");
      
      const data = await obtenerInventario(debouncedSearch.trim() || undefined);
      const inventario = data.records || [];
      const mappedItems: InventoryItem[] = inventario
        .filter((i: any) => i.fields.articulo)
        .map((i: any) => ({
          id: String(i.id),
          name: i.fields.articulo || '',
          sku: i.fields.sku || '',
          category: i.fields.Categoria || '',
          units: i.fields.Actual || 0,
          minUnits: i.fields.Minimo || 0,
          unit: i.fields.unidad || 'uds.'
        }));
      setItems(mappedItems);
    } catch (err) {
      toast.error("Error al eliminar el artículo");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Material para maleta de desplazamiento, consumibles y ortesis con alertas de stock mínimo
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {loading && items.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={`sk-${i}`} className="card-shadow border-primary/10">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                    <div className="min-w-0">
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-10 w-24 rounded-md" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card className="card-shadow border-primary/10">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Warehouse className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums">{animatedTotalSkus}</p>
                    <p className="text-xs text-muted-foreground">Referencias</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex shrink-0">
                  <SparklineAreaAnimated values={inventorySparklines.skus} delayMs={0} colorClassName="text-primary" />
                </span>
              </CardContent>
            </Card>
            <Card className="card-shadow border-primary/10">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums">{animatedTotalUnits}</p>
                    <p className="text-xs text-muted-foreground">Unidades totales</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex shrink-0">
                  <SparklineAreaAnimated values={inventorySparklines.units} delayMs={85} colorClassName="text-primary" />
                </span>
              </CardContent>
            </Card>
            <Card className={cn("card-shadow", lowStock.length > 0 && "border-warning/40 bg-warning/[0.04]")}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums">{animatedLowStock}</p>
                    <p className="text-xs text-muted-foreground">Alertas de reposición</p>
                    <p className="text-[11px] mt-0.5">
                      {lowStock.length > 0
                        ? <span className="text-warning font-medium">{lowStock.length} artículo(s) bajo mínimo</span>
                        : <span className="text-success font-medium">Stock óptimo</span>}
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex shrink-0">
                  <SparklineAreaAnimated values={inventorySparklines.alerts} delayMs={170} colorClassName="text-warning" />
                </span>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {lowStock.length > 0 && (
        <Card className="card-shadow border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Requiere pedido
            </CardTitle>
            <CardDescription>Artículos en o por debajo del stock mínimo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <Badge key={i.id} variant="outline" className="border-warning/40 text-foreground font-normal">
                {i.name} · {i.units} {i.unit}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="card-shadow">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Stock por artículo</CardTitle>
            <CardDescription>Progreso respecto al mínimo configurado (100% = en mínimo)</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, SKU o categoría..."
                className="pl-9 bg-muted/40 border-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="button" onClick={openAdd} className="shrink-0 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Agregar artículo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch', padding: '15px 25px' }}>
            <Table className="min-w-[900px] [&_td]:py-1.5 [&_td]:px-2 [&_th]:py-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Artículo</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="w-[220px]">Nivel</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Buscando en el servidor...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay resultados
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => {
                  const ratio = i.units > 0 ? Math.min(100, (i.minUnits / i.units) * 100) : 0;
                  const critical = i.units <= i.minUnits;
                  const highLevel = ratio >= 90;
                  const midLevel = ratio >= 50 && ratio < 90;
                  const progressColor = highLevel ? 'text-destructive' : midLevel ? 'text-warning' : critical ? 'text-warning' : 'text-primary';
                  const levelMessage = highLevel ? 'Nivel crítico' : midLevel ? 'Nivel medio' : critical ? 'Stock bajo' : 'Nivel óptimo';
                  return (
                    <TableRow key={i.id} className="group hover:bg-muted/30 h-[20px]">
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{i.sku}</TableCell>
                      <TableCell className="">
                        <Badge variant="outline" className={cn("font-normal border", getCategoryColor(i.category))}>
                          {i.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Progress value={ratio} className={cn("h-2", highLevel && "[&>div]:!bg-destructive", midLevel && "[&>div]:!bg-warning", critical && "[&>div]:!bg-warning")} />
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-[10px] text-muted-foreground">Mín. {i.minUnits} {i.unit}</p>
                          <p className={cn("text-[10px] font-medium", progressColor)}>{levelMessage}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-middle">
                        {i.units} <span className="text-muted-foreground text-xs">{i.unit}</span>
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => openEdit(i)}>
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
                                  <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará del inventario a <span className="font-medium text-foreground">{i.name}</span>.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteItem(i.id)}
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
                  );
                })
              )}
              </TableBody>
            </Table>
          </div>
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
                <Package className="h-5 w-5" style={{ color: '#22b4ad' }} />
              </div>
              <div>
                <DialogTitle className="text-[18px] font-medium text-foreground">{editingId ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
                <p className="text-[13px] text-gray-500 mt-1">
                  {editingId ? "Actualiza stock, mínimos y datos del artículo." : "Registra un nuevo producto en el inventario de desplazamiento."}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-6 sm:overflow-visible max-sm:overflow-y-auto max-sm:max-h-[calc(90vh-180px)]">
            {/* Sección Información del artículo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Información del artículo</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Nombre</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Vendas elásticas 10 cm"
                  className="text-sm"
                  style={{
                    backgroundColor: '#f5fffe',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: 'none'
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">SKU</Label>
                  <Input
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="CON-099"
                    className="text-sm font-mono"
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Categoría</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className="text-sm" style={{ backgroundColor: '#f5fffe', border: 'none', borderRadius: '8px', boxShadow: 'none' }}>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quirúrgico">Quirúrgico</SelectItem>
                      <SelectItem value="Higiene">Higiene</SelectItem>
                      <SelectItem value="Ortesis">Ortesis</SelectItem>
                      <SelectItem value="Consumibles">Consumibles</SelectItem>
                      <SelectItem value="Equipo móvil">Equipo móvil</SelectItem>
                      <SelectItem value="Farmacia">Farmacia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sección Stock */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Stock</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Stock actual</Label>
                  <Input
                    type="number"
                    min={0}
                    className="text-sm tabular-nums"
                    value={formUnits}
                    onChange={(e) => setFormUnits(e.target.value)}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Stock mínimo</Label>
                  <Input
                    type="number"
                    min={0}
                    className="text-sm tabular-nums"
                    value={formMinUnits}
                    onChange={(e) => setFormMinUnits(e.target.value)}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Unidad</Label>
                  <Input
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="uds."
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
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="text-sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSave} className="text-sm" style={{ backgroundColor: '#22b4ad', color: 'white' }}>
              {editingId ? "Guardar cambios" : "Agregar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
