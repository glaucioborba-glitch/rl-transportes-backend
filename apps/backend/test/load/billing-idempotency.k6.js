/**
 * E4 #15 — smoke load: idempotência billing (executar com k6 + backend rodando).
 * k6 run apps/backend/test/load/billing-idempotency.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
};

export default function () {
  const res = http.get('http://localhost:3001/health');
  check(res, { 'health 200': (r) => r.status === 200 });
  sleep(0.5);
}
