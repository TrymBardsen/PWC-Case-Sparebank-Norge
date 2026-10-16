// Hindrer at serveren henter fra interne adresser (SSRF) når nettkilder fra KI-rapporten kontrolleres.

import { isIP } from "node:net";

function privatIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // lenkelokal, inkl. skyens metadata-tjeneste
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast og reservert
  );
}

export function privatAdresse(ip: string): boolean {
  const type = isIP(ip);
  if (type === 4) return privatIpv4(ip);
  if (type !== 6) return true; // ukjent format: avvis
  const v6 = ip.toLowerCase();
  const mappet = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappet) return privatIpv4(mappet[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff") || v6.startsWith("::ffff:");
}
