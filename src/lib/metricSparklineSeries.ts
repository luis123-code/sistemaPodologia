import { addDaysIso } from "@/lib/clinicDates";
import type { Appointment, Invoice, InventoryItem, MedicalRecord, Patient, PodiatryService } from "@/data/mockData";


export function ensureSparklineSeries(values: number[]): number[] {
  if (values.length >= 2) return values;
  if (values.length === 1) return [values[0], values[0]];
  return [0, 0];
}


export function dayWindowEndInclusive(endInclusive: string, length: number): string[] {
  const n = Math.max(2, length);
  return Array.from({ length: n }, (_, i) => addDaysIso(endInclusive, -(n - 1 - i)));
}


export function cumulativeCountChronological<T>(items: T[], getDate: (t: T) => string): number[] {
  if (items.length === 0) return [0, 0];
  
  const validItems = items.filter((item) => {
    const date = getDate(item);
    return date && typeof date === 'string' && date.length > 0;
  });
  if (validItems.length === 0) return [0, 0];
  const sorted = validItems.sort((a, b) => getDate(a).localeCompare(getDate(b)));
  return sorted.map((_, i) => i + 1);
}


export function cumulativeCountChronologicalFiltered<T>(
  items: T[],
  getDate: (t: T) => string,
  predicate: (t: T) => boolean,
): number[] {
  return cumulativeCountChronological(items.filter(predicate), getDate);
}


export function cumulativeCountsPerDayInRange(
  fromInclusive: string,
  toInclusive: string,
  countForDay: (dayIso: string) => number,
): number[] {
  if (fromInclusive > toInclusive) return [0, 0];
  const series: number[] = [];
  let cum = 0;
  let d = fromInclusive;
  while (d <= toInclusive) {
    cum += countForDay(d);
    series.push(cum);
    d = addDaysIso(d, 1);
  }
  return series.length ? ensureSparklineSeries(series) : [0, 0];
}


export function appointmentsPerDayWindow(appointments: Appointment[], referenceToday: string, numDays: number): number[] {
  const days = dayWindowEndInclusive(referenceToday, numDays);
  return ensureSparklineSeries(days.map((d) => appointments.filter((a) => a?.date === d).length));
}

export function cumulativePatientsByRegistration(patients: Patient[]): number[] {
  return cumulativeCountChronological(patients, (p) => p?.registeredAt || "");
}

export function cumulativePatientsWithStatus(patients: Patient[], status: Patient["status"]): number[] {
  if (patients.length === 0) return [0, 0];
  
  const validPatients = patients.filter(p => p?.registeredAt && typeof p.registeredAt === 'string');
  if (validPatients.length === 0) return [0, 0];
  const sorted = [...validPatients].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
  let c = 0;
  return sorted.map((p) => {
    if (p.status === status) c += 1;
    return c;
  });
}


export function cumulativeNewPatientsInMonth(patients: Patient[], monthStart: string, nextMonthStart: string): number[] {
  const lastDay = addDaysIso(nextMonthStart, -1);
  return cumulativeCountsPerDayInRange(monthStart, lastDay, (d) => patients.filter((p) => p.registeredAt === d).length);
}

export function cumulativeMedicalRecordsByDate(records: MedicalRecord[]): number[] {
  return cumulativeCountChronological(records, (r) => r.date);
}

export function runningUniquePatientCount(records: MedicalRecord[]): number[] {
  if (records.length === 0) return [0, 0];
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  return sorted.map((r) => {
    seen.add(r.patientId);
    return seen.size;
  });
}

export function runningUniqueDiagnosisCount(records: MedicalRecord[]): number[] {
  if (records.length === 0) return [0, 0];
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  return sorted.map((r) => {
    seen.add(r.diagnosis);
    return seen.size;
  });
}


export function cumulativeRecordsInMonthChronological(
  records: MedicalRecord[],
  monthStart: string,
  nextMonthStart: string,
): number[] {
  const inMonth = records.filter((r) => r.date >= monthStart && r.date < nextMonthStart);
  if (inMonth.length === 0) return [0, 0];
  const sorted = [...inMonth].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return sorted.map((_, i) => i + 1);
}

export function cumulativeAppointmentsByDate(appointments: Appointment[]): number[] {
  return cumulativeCountChronological(appointments, (a) => a.date);
}

export function cumulativeInvoiceCountByDate(invoices: Invoice[]): number[] {
  return cumulativeCountChronological(invoices, (i) => i.date);
}

export function cumulativeInvoiceAmountByDate(invoices: Invoice[]): number[] {
  if (invoices.length === 0) return [0, 0];
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date));
  let s = 0;
  return sorted.map((inv) => {
    s += inv.amountPen;
    return s;
  });
}

export function cumulativePendingInvoiceAmount(invoices: Invoice[]): number[] {
  const pend = invoices.filter((i) => i.status?.toLowerCase() === "pendiente");
  if (pend.length === 0) return [0, 0];
  const sorted = [...pend].sort((a, b) => a?.date?.localeCompare(b?.date || "") || 0);
  let s = 0;
  return sorted.map((inv) => {
    s += inv?.amountPen || 0;
    return s;
  });
}

export function cumulativeSkuCount(items: InventoryItem[]): number[] {
  if (items.length === 0) return [0, 0];
  return items.map((_, i) => i + 1);
}

export function cumulativeUnitsInListOrder(items: InventoryItem[]): number[] {
  if (items.length === 0) return [0, 0];
  let s = 0;
  return items.map((i) => {
    s += i.units;
    return s;
  });
}

export function cumulativeLowStockAlertsInListOrder(items: InventoryItem[]): number[] {
  if (items.length === 0) return [0, 0];
  let c = 0;
  return items.map((i) => {
    if (i.units <= i.minUnits) c += 1;
    return c;
  });
}

export function cumulativeServiceCount(services: PodiatryService[]): number[] {
  if (services.length === 0) return [0, 0];
  return services.map((_, i) => i + 1);
}

export function runningAverageServicePrice(services: PodiatryService[]): number[] {
  if (services.length === 0) return [0, 0];
  let sum = 0;
  return services.map((s, idx) => {
    sum += s.pricePen;
    return sum / (idx + 1);
  });
}


export function serviceCountsByCategoryTriplet(services: PodiatryService[]): number[] {
  let c = 0;
  let q = 0;
  let o = 0;
  for (const s of services) {
    if (s.category === "consulta") c += 1;
    else if (s.category === "quirurgico") q += 1;
    else o += 1;
  }
  return ensureSparklineSeries([c, q, o]);
}
