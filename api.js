const BASE = "https://backend-iguideu-2.onrender.com"; // usar local: http://127.0.0.1:3000 en desarrollo

export async function createIntent(amount = 1999, currency = "usd") {
  const res = await fetch(`${BASE}/api/payments/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency })
  });
  const data = await res.json();
  console.log("payment intent (stub):", data);
  return data;
}
