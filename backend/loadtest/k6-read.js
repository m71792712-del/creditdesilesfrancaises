// Test de charge en LECTURE sur un projet Supabase de TEST (jamais la production), comptes fictifs uniquement.
// Installation de k6 : https://k6.io — puis :
//   k6 run -e SUPABASE_URL=https://xxxx.supabase.co -e SUPABASE_ANON_KEY=... \
//          -e TEST_EMAIL=compte-test@example.com -e TEST_PASSWORD=... loadtest/k6-read.js
// La création de demandes n'est pas testée en charge : elle est volontairement limitée à 5/heure/utilisateur.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 100 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.SUPABASE_ANON_KEY;

export function setup() {
  const res = http.post(
    `${URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json', apikey: KEY } },
  );
  check(res, { 'connexion de test réussie': (r) => r.status === 200 });
  return { token: res.json('access_token') };
}

export default function (data) {
  const headers = { apikey: KEY, Authorization: `Bearer ${data.token}` };
  const calls = [
    '/rest/v1/banks?select=id,slug,name,territory,type&is_active=eq.true&order=name&limit=100',
    '/rest/v1/loan_purposes?select=code,label_fr,label_en&order=sort_order',
    '/rest/v1/card_types?select=id,family,name&order=sort_order',
    '/rest/v1/loan_requests?select=id,amount,currency,purpose_code,status,created_at&order=created_at.desc,id.desc&limit=10',
    '/rest/v1/app_settings?select=key,value',
  ];
  for (const path of calls) {
    const res = http.get(`${URL}${path}`, { headers });
    check(res, { 'statut 200': (r) => r.status === 200 });
    sleep(0.5 + Math.random());
  }
}
