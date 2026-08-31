async function test() {
  for (let i = 0; i < 5; i++) {
    const o = await (await fetch('http://localhost:3000/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'STEAM-TOPUP-500' })
    })).json();
    await fetch('http://localhost:3000/webhook/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: 'evt_flow_' + Date.now() + '_' + i,
        order_id: o.orderId,
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString()
      })
    });
    const d = await (await fetch('http://localhost:3000/delivery/' + o.orderId, { method: 'POST' })).json();
    console.log(i + 1, d.status, d.code || 'no code');
  }
}
test();
