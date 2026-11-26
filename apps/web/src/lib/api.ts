// Format integer minor units as an AED currency amount.
export function money(amount: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format(amount / 100);
}
// Decode structured audit content without losing plain text entries.
export function decode(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
// Perform a scoped API request and expose readable server errors.
export async function api(path: string, identity: string, body?: unknown) {
  const response = await fetch("/api" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Identity": identity },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((entry: { msg: string }) => entry.msg).join("; ")
      : data.detail;
    throw new Error(message || "Request failed");
  }
  return data;
}
