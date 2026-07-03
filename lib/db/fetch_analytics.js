async function main() {
  const url = 'http://localhost:3002/api/dashboard/analytics?year=2026&month=6&date=2026-06-30';
  console.log("Fetching from:", url);
  try {
    const res = await fetch(url, {
      headers: {
        // Mocking administrative session
        "cookie": "sid=admin" // or whatever auth is used, or let's inspect requireAdmin middleware
      }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
main();
