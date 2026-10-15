import type { Bransje } from "./types.ts";

// Typiske sesongprofiler for innbetalinger per bransje (jan–des).
export const SESONG: Record<Bransje, number[]> = {
  "Bygg og anlegg": [0.75, 0.8, 0.95, 1.05, 1.1, 1.15, 0.8, 1.05, 1.15, 1.15, 1.05, 0.85],
  Servering: [0.75, 0.8, 0.9, 0.95, 1.05, 1.15, 1.2, 1.15, 1.0, 0.95, 1.0, 1.4],
  Varehandel: [0.8, 0.8, 0.9, 0.95, 1.0, 1.0, 0.95, 1.0, 0.95, 1.0, 1.15, 1.5],
  Transport: [0.9, 0.9, 1, 1, 1.05, 1.05, 0.9, 1, 1.05, 1.05, 1.05, 1.05],
  Industri: [0.95, 1, 1.05, 1, 1, 1, 0.75, 1, 1.05, 1.05, 1.05, 1.05],
  Helse: [1, 1, 1, 1, 1, 1, 0.75, 1, 1.05, 1.05, 1.05, 1.05],
  "IT og rådgivning": [1, 1, 1, 1, 1, 1, 0.8, 1, 1.05, 1.05, 1.05, 1],
  Eiendomsdrift: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Personlig tjenesteyting": [0.9, 0.9, 1, 1, 1.05, 1.1, 0.9, 1, 1, 1, 1.05, 1.2],
  Næringsmiddel: [0.9, 0.9, 0.95, 1.05, 1, 1, 0.95, 1, 1, 1, 1.05, 1.3],
};

// Bransjerisiko basert på konkursstatistikk (SSB, forenklet til tre nivåer)
export const BRANSJERISIKO: Record<Bransje, "høy" | "middels" | "lav"> = {
  "Bygg og anlegg": "høy",
  Servering: "høy",
  Varehandel: "høy",
  Transport: "middels",
  Industri: "middels",
  Helse: "lav",
  "IT og rådgivning": "lav",
  Eiendomsdrift: "middels",
  "Personlig tjenesteyting": "middels",
  Næringsmiddel: "middels",
};
