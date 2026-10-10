/** "Hoje" no fuso da academia, em YYYY-MM-DD. Nunca use toISOString().slice(0,10): vira o dia às 21h em Brasília. */
export function hojeNoFuso(agora: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

export function horaNoFuso(instante: Date, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false }).format(instante)
}

/** 0 = domingo. */
export function diaDaSemana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}
