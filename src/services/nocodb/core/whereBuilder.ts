

export const wb = {
  
  eq: (col: string, val: string | number | boolean): string =>
    `(${col},eq,${encodeURIComponent(String(val))})`,

  
  neq: (col: string, val: string | number): string =>
    `(${col},neq,${encodeURIComponent(String(val))})`,

  
  like: (col: string, val: string): string =>
    `(${col},like,%${encodeURIComponent(val)}%)`,

  
  is: (col: string, val: 'true' | 'false' | 'null'): string =>
    `(${col},is,${val})`,

  
  gt: (col: string, val: number): string =>
    `(${col},gt,${val})`,

  
  lt: (col: string, val: number): string =>
    `(${col},lt,${val})`,

  
  in: (col: string, ...vals: string[]): string =>
    `(${col},in,${vals.join(',')})`,

  
  and: (...conditions: string[]): string =>
    conditions.join('~and'),

  
  or: (...conditions: string[]): string =>
    conditions.join('~or'),

  
  not: (condition: string): string =>
    `~not${condition}`,
};
