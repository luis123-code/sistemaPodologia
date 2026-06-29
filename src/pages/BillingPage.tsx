import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { CreditCard, Receipt, Search, TrendingUp, Plus, Pencil, X, MoreVertical, Loader2 } from "lucide-react";
import { PatientSearchDropdown } from "@/components/PatientSearchDropdown";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { Invoice } from "@/data/mockData";
import { buscarPacientePorNombre, obtenerPacientesRegistrados } from "@/services/nocodb/pacientes.service";
import { obtenerFacturacion, crearFacturacion, actualizarFacturacion, eliminarFacturacion } from "@/services/nocodb/facturacion.service";
import { cn } from "@/lib/utils";
import { formatSoles } from "@/lib/currency";
import { toast } from "sonner";
import { SparklineAreaAnimated } from "@/components/charts/SparklineAreaAnimated";
import {
  cumulativeInvoiceAmountByDate,
  cumulativeInvoiceCountByDate,
  cumulativePendingInvoiceAmount,
} from "@/lib/metricSparklineSeries";

const statusBadge = (status: string) => {
  if (status === "Pagado") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "parcial") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
};

function suggestInvoiceId(existing: Invoice[]) {
  let maxNum = 0;
  const re = /^F-2026-(\d+)$/;
  for (const inv of existing) {
    const m = inv.id.match(re);
    if (m) maxNum = Math.max(maxNum, Number.parseInt(m[1], 10));
  }
  const next = maxNum + 1;
  return `F-2026-${String(next).padStart(4, "0")}`;
}

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [oldPatientId, setOldPatientId] = useState<number | null>(null);
  const [formId, setFormId] = useState("");
  const [formPatient, setFormPatient] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formConcept, setFormConcept] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formStatus, setFormStatus] = useState<Invoice["status"]>("Pendiente");
  const location = useLocation();

  useEffect(() => {
    const state = (location.state as any) || {};
    if (state.patientId) {
      setSelectedPatientId(state.patientId);
      setPatientSearch(state.patientName || "");
      setFormPatient(state.patientName || "");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormConcept("");
      setFormAmount("");
      setFormStatus("Pendiente");
      setEditingId(null);
      setDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const searchDebounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      // La búsqueda se maneja en el useEffect de carga de facturas
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search]);

  
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patientDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadAllPatients = async () => {
    if (patientResults.length > 0) return;
    setPatientLoading(true);
    try {
      const data = await obtenerPacientesRegistrados();
      setPatientResults(data.pacientes || []);
      setShowPatientDropdown(true);
    } catch (err) {
    } finally {
      setPatientLoading(false);
    }
  };

  
  useEffect(() => {
    if (patientDebounceRef.current) {
      clearTimeout(patientDebounceRef.current);
    }
    
    if (patientSearch.trim().length > 0) {
      setPatientLoading(true);
      patientDebounceRef.current = setTimeout(async () => {
        try {
          const data = await buscarPacientePorNombre(patientSearch);
          const pacientes = data.records || [];
          setPatientResults(pacientes);
          setShowPatientDropdown(true);
        } catch (err) {
          setPatientResults([]);
        } finally {
          setPatientLoading(false);
        }
      }, 500);
    } else if (patientSearch.trim().length === 0) {
      
      setPatientResults([]);
      setShowPatientDropdown(false);
      setPatientLoading(false);
    }
    
    return () => {
      if (patientDebounceRef.current) {
        clearTimeout(patientDebounceRef.current);
      }
    };
  }, [patientSearch]);

  
  
  useEffect(() => {
    const loadInvoices = async () => {
      setInvoicesLoading(true);
      try {
        const data = await obtenerFacturacion({ 
          estado: status,
          search: search.trim() || undefined 
        });
        const facturas = data.records || [];
        
        const mappedInvoices = facturas.map((f: any) => ({
          rowId: f.id, // ID de la fila en NocoDB
          id: f.fields.Factura || "",
          patientId: f.fields.Pacientes?.id, // ID del paciente en NocoDB
          patientName: f.fields.Pacientes?.fields?.nombreCompleto || "Desconocido",
          date: f.fields.fecha || "",
          concept: f.fields.Concepto || "",
          amountPen: f.fields.Importe || 0,
          status: f.fields.Estado as Invoice["status"] || "Pendiente",
        }));
        setInvoicesList(mappedInvoices);
      } catch (err) {
        toast.error("Error al cargar facturas");
      } finally {
        setInvoicesLoading(false);
      }
    };
    loadInvoices();
  }, [status, search]);

  const filtered = useMemo(() => {
    return invoicesList.filter((inv) => {
      if (dateFrom && inv.date < dateFrom) return false;
      if (dateTo && inv.date > dateTo) return false;
      return true;
    });
  }, [invoicesList, dateFrom, dateTo]);

  const total = invoicesList.reduce((a, i) => a + i.amountPen, 0);
  const pendiente = invoicesList.filter((i) => i.status === "Pendiente").reduce((a, i) => a + i.amountPen, 0);

  
  const animTotal = useAnimatedNumber(total, 1200);
  const animPendiente = useAnimatedNumber(pendiente, 1200);
  const animCount = useAnimatedNumber(invoicesList.length, 1200);

  const billingSparklines = useMemo(
    () => ({
      count: cumulativeInvoiceCountByDate(invoicesList),
      totalPen: cumulativeInvoiceAmountByDate(invoicesList),
      pendientePen: cumulativePendingInvoiceAmount(invoicesList),
    }),
    [invoicesList],
  );

  const openAdd = () => {
    setEditingId(null);
    setOldPatientId(null);
    setFormId(suggestInvoiceId(invoicesList));
    setFormPatient("");
    setPatientSearch("");
    setSelectedPatientId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormConcept("");
    setFormAmount("");
    setFormStatus("Pendiente");
    setDialogOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(String(inv.rowId || inv.id)); 
    setOldPatientId(inv.patientId || null); 
    setSelectedPatientId(inv.patientId ? String(inv.patientId) : null); 
    setFormId(inv.id);
    setFormPatient(inv.patientName);
    setPatientSearch(inv.patientName);
    setFormDate(inv.date);
    setFormConcept(inv.concept);
    setFormAmount(String(inv.amountPen));
    setFormStatus(inv.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const id = formId.trim();
    const patientName = formPatient.trim();
    const date = formDate.trim();
    const concept = formConcept.trim();
    const amountPen = Number.parseFloat(formAmount.replace(",", "."));

    if (!id) {
      toast.error("Indica el número de factura");
      return;
    }
    if (!patientName) {
      toast.error("Indica el paciente");
      return;
    }
    if (!date) {
      toast.error("Indica la fecha");
      return;
    }
    if (!concept) {
      toast.error("Indica el concepto");
      return;
    }
    if (!Number.isFinite(amountPen) || amountPen < 0) {
      toast.error("Importe no válido");
      return;
    }

    try {
      const estadoCapitalizado = formStatus.charAt(0).toUpperCase() + formStatus.slice(1).toLowerCase();
      
      if (editingId) {
        
        await actualizarFacturacion(editingId, {
          Factura: id,
          fecha: date,
          Concepto: concept,
          Importe: amountPen,
          Estado: estadoCapitalizado,
          Pacientes: selectedPatientId ? [{ id: selectedPatientId }] : [],
        }, oldPatientId || undefined);
        toast.success("Factura actualizada");
      } else {
        
        await crearFacturacion({
          Factura: id,
          fecha: date,
          Concepto: concept,
          Importe: amountPen,
          Estado: estadoCapitalizado,
          Pacientes: selectedPatientId ? [{ id: selectedPatientId }] : [],
        });
        toast.success("Factura registrada");
      }
      
      
      const data = await obtenerFacturacion();
      const facturas = data.records || [];
      const mappedInvoices = facturas.map((f: any) => ({
        rowId: f.id,
        patientId: f.fields.Pacientes?.id,
        id: f.fields.Factura || "",
        patientName: f.fields.Pacientes?.fields?.nombreCompleto || "Desconocido",
        date: f.fields.fecha || "",
        concept: f.fields.Concepto || "",
        amountPen: f.fields.Importe || 0,
        status: f.fields.Estado as Invoice["status"] || "Pendiente",
      }));
      setInvoicesList(mappedInvoices);
      
      setDialogOpen(false);
      setEditingId(null);
    } catch (err) {
      toast.error("Error al guardar factura");
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      
      const data = await obtenerFacturacion();
      const factura = data.records.find((f: any) => f.fields.Factura === id);
      
      if (factura) {
        await eliminarFacturacion((factura as any).id);
        toast.success("Factura eliminada");
        
        
        const newData = await obtenerFacturacion();
        const facturas = newData.records || [];
        const mappedInvoices = facturas.map((f: any) => ({
          rowId: f.id,
          patientId: f.fields.Pacientes?.id,
          id: f.fields.Factura || "",
          patientName: f.fields.Pacientes?.fields?.nombreCompleto || "Desconocido",
          date: f.fields.fecha || "",
          concept: f.fields.Concepto || "",
          amountPen: f.fields.Importe || 0,
          status: f.fields.Estado as Invoice["status"] || "Pendiente",
        }));
        setInvoicesList(mappedInvoices);
      } else {
        toast.error("Factura no encontrada");
      }
    } catch (err) {
      toast.error("Error al eliminar factura");
    }
  };

  
  if (invoicesLoading && invoicesList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Cargando facturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Facturación de visitas a domicilio, cobros y saldos pendientes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                {invoicesLoading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Receipt className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{invoicesLoading ? "..." : animCount}</p>
                <p className="text-xs text-muted-foreground">Facturas</p>
              </div>
            </div>
            {!invoicesLoading && (
              <span className="hidden sm:inline-flex shrink-0">
                <SparklineAreaAnimated values={billingSparklines.count} delayMs={0} colorClassName="text-primary" />
              </span>
            )}
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                {invoicesLoading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <TrendingUp className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{invoicesLoading ? "..." : formatSoles(animTotal)}</p>
                <p className="text-xs text-muted-foreground">Importe acumulado</p>
              </div>
            </div>
            {!invoicesLoading && (
              <span className="hidden sm:inline-flex shrink-0">
                <SparklineAreaAnimated values={billingSparklines.totalPen} delayMs={85} colorClassName="text-primary" />
              </span>
            )}
          </CardContent>
        </Card>
        <Card className="card-shadow border-primary/10">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
                {invoicesLoading ? <Loader2 className="h-5 w-5 text-warning animate-spin" /> : <CreditCard className="h-5 w-5 text-warning" />}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{invoicesLoading ? "..." : formatSoles(animPendiente)}</p>
                <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
              </div>
            </div>
            {!invoicesLoading && (
              <span className="hidden sm:inline-flex shrink-0">
                <SparklineAreaAnimated values={billingSparklines.pendientePen} delayMs={170} colorClassName="text-warning" />
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow">
        <CardHeader className="flex flex-col gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Listado</CardTitle>
            <CardDescription>Filtra por estado o busca por paciente o número de factura</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3 w-full items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="text-[11px] text-transparent font-medium select-none">Buscar</span>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${invoicesLoading ? 'opacity-0' : ''}`} />
                {invoicesLoading && (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
                )}
                <Input
                  placeholder="Buscar..."
                  className="pl-9 bg-muted/40 border-0 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Desde</span>
                <Input
                  type="date"
                  className="w-full bg-muted/40 border-0"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Hasta</span>
                <Input
                  type="date"
                  className="w-full bg-muted/40 border-0"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-transparent font-medium select-none">Estado</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-[180px] bg-muted/40 border-0 hover:bg-muted/40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Pagado">Pagado</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Parcial">Pago parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-transparent font-medium select-none">Acción</span>
              <Button type="button" onClick={openAdd} className="w-full sm:w-auto shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Agregar factura
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full min-w-0 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch', padding: '15px 25px' }}>
            <Table className="[&_td]:py-1.5 [&_td]:px-2 [&_th]:py-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Factura</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {invoicesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando facturas...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No hay facturas para mostrar</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.id} className="group hover:bg-muted/30 h-[20px]">
                    <TableCell className="font-mono text-xs font-medium">{inv.id}</TableCell>
                    <TableCell className="">{inv.patientName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.date}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{inv.concept}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatSoles(inv.amountPen)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("capitalize border", statusBadge(inv.status))}>{inv.status}</Badge>
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
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
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
                              <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará la factura <span className="font-medium text-foreground">{inv.id}</span> de <span className="font-medium text-foreground">{inv.patientName}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteInvoice(inv.id)}
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
                <Receipt className="h-5 w-5" style={{ color: '#22b4ad' }} />
              </div>
              <div>
                <DialogTitle className="text-[18px] font-medium text-foreground">{editingId ? "Editar factura" : "Nueva factura"}</DialogTitle>
                <p className="text-[13px] text-gray-500 mt-1">
                  {editingId ? "Modifica los datos de la factura." : "Registra una nueva factura de visita o material."}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="px-6 py-5 space-y-6 sm:overflow-visible max-sm:overflow-y-auto max-sm:max-h-[calc(90vh-180px)]">
            {/* Sección Información de la factura */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Información de la factura</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Nº factura</Label>
                  <Input
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="F-2026-0150"
                    className="text-sm font-mono"
                    disabled={!!editingId}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                  {editingId && (
                    <p className="text-[10px] text-muted-foreground">El número de factura no se puede cambiar al editar.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Fecha</Label>
                  <Input
                    type="date"
                    className="text-sm"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Paciente</Label>
                <PatientSearchDropdown
                  value={patientSearch}
                  onChange={(value) => {
                    setPatientSearch(value);
                    setFormPatient(value);
                  }}
                  onSelect={(paciente) => {
                    const nombreCompleto = paciente.fields.nombreCompleto || `${paciente.fields.nombre || ""} ${paciente.fields.apellido || ""}`.trim();
                    setFormPatient(nombreCompleto);
                    setPatientSearch(nombreCompleto);
                    setSelectedPatientId(paciente.id);
                    setShowPatientDropdown(false);
                  }}
                  results={patientResults}
                  loading={patientLoading}
                  showDropdown={showPatientDropdown}
                  setShowDropdown={setShowPatientDropdown}
                  placeholder="Buscar paciente..."
                  loadOnFocus={loadAllPatients}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-gray-500 font-medium">Concepto</Label>
                <Input
                  value={formConcept}
                  onChange={(e) => setFormConcept(e.target.value)}
                  placeholder="Descripción del cargo"
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

            {/* Sección Importe y estado */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#0f7e78' }}>Importe y estado</span>
                <div className="flex-1 h-[0.5px]" style={{ backgroundColor: 'rgba(34, 180, 173, 0.15)' }}></div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Importe (soles)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="text-sm tabular-nums"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    style={{
                      backgroundColor: '#f5fffe',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-gray-500 font-medium">Estado</Label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v as Invoice["status"])}>
                    <SelectTrigger className="text-sm" style={{ backgroundColor: '#f5fffe', border: 'none', borderRadius: '8px', boxShadow: 'none' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pagado">Pagado</SelectItem>
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="Parcial">Pago parcial</SelectItem>
                    </SelectContent>
                  </Select>
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
