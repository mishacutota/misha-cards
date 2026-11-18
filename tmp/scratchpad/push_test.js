(async () => {
  const url = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1ea6233bc08a7';
  const body = JSON.stringify({ name: 'misha-cards-db', data: { format: 'misha-cards-v2', version: 2, users: {}, stock: {}, history: [] } });
  console.log('body len', body.length);
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
  console.log('status', res.status, res.statusText);
  console.log('text', (await res.text()).slice(0, 200));
  // try PATCH
  const res2 = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  console.log('patch status', res2.status);
})();
