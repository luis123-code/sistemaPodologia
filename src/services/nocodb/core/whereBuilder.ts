/**
 * Where Builder para NocoDB API v3
 * Helper para construir where clauses sin errores de encoding
 * 
 * Documentación: https://nocodb.com/docs/rest-apis
 */

export const wb = {
  /**
   * Igual — encodea automáticamente para valores con | u otros caracteres especiales
   * @param col - Nombre del campo
   * @param val - Valor a comparar
   * @returns where clause string
   * @example wb.eq('paciente_id', 5) → "(paciente_id,eq,5)"
   * @example wb.eq('auth0_sub', 'google-oauth2|107157859478777221556') → "(auth0_sub,eq,google-oauth2%7C107157859478777221556)"
   */
  eq: (col: string, val: string | number | boolean): string =>
    `(${col},eq,${encodeURIComponent(String(val))})`,

  /**
   * No igual
   * @param col - Nombre del campo
   * @param val - Valor a comparar
   * @returns where clause string
   * @example wb.neq('estado', 'cancelada') → "(estado,neq,cancelada)"
   */
  neq: (col: string, val: string | number): string =>
    `(${col},neq,${encodeURIComponent(String(val))})`,

  /**
   * Contiene texto (para búsquedas)
   * @param col - Nombre del campo
   * @param val - Texto a buscar
   * @returns where clause string
   * @example wb.like('nombre', 'juan') → "(nombre,like,%juan%)"
   */
  like: (col: string, val: string): string =>
    `(${col},like,%${encodeURIComponent(val)}%)`,

  /**
   * Boolean true/false/null
   * @param col - Nombre del campo
   * @param val - Valor booleano o null
   * @returns where clause string
   * @example wb.is('activo', 'true') → "(activo,is,true)"
   */
  is: (col: string, val: 'true' | 'false' | 'null'): string =>
    `(${col},is,${val})`,

  /**
   * Mayor que
   * @param col - Nombre del campo
   * @param val - Valor numérico
   * @returns where clause string
   * @example wb.gt('precio', 100) → "(precio,gt,100)"
   */
  gt: (col: string, val: number): string =>
    `(${col},gt,${val})`,

  /**
   * Menor que
   * @param col - Nombre del campo
   * @param val - Valor numérico
   * @returns where clause string
   * @example wb.lt('precio', 500) → "(precio,lt,500)"
   */
  lt: (col: string, val: number): string =>
    `(${col},lt,${val})`,

  /**
   * En lista de valores
   * @param col - Nombre del campo
   * @param vals - Lista de valores
   * @returns where clause string
   * @example wb.in('estado', 'programada', 'confirmada', 'en_camino') → "(estado,in,programada,confirmada,en_camino)"
   */
  in: (col: string, ...vals: string[]): string =>
    `(${col},in,${vals.join(',')})`,

  /**
   * Combinar condiciones con AND
   * @param conditions - Lista de condiciones where
   * @returns where clause string combinada con ~and
   * @example wb.and(wb.eq('estado', 'programada'), wb.is('activo', 'true')) → "(estado,eq,programada)~and(activo,is,true)"
   */
  and: (...conditions: string[]): string =>
    conditions.join('~and'),

  /**
   * Combinar condiciones con OR
   * @param conditions - Lista de condiciones where
   * @returns where clause string combinada con ~or
   * @example wb.or(wb.like('nombre', 'juan'), wb.like('apellido', 'juan')) → "(nombre,like,%juan%)~or(apellido,like,%juan%)"
   */
  or: (...conditions: string[]): string =>
    conditions.join('~or'),

  /**
   * Negar condición
   * @param condition - Condición where a negar
   * @returns where clause string negada
   * @example wb.not(wb.eq('estado', 'cancelada')) → "~not(estado,eq,cancelada)"
   */
  not: (condition: string): string =>
    `~not${condition}`,
};
