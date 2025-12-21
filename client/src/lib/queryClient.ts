import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let errorMessage = res.statusText;
    
    // Clone the response so we can read it without consuming the original
    const clonedRes = res.clone();
    
    // Try to parse as JSON first, fallback to text
    try {
      const text = await clonedRes.text();
      
      // Check if response is HTML (error page)
      if (contentType && contentType.includes("text/html")) {
        // If it's HTML, try to extract a meaningful error message
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          errorMessage = `Server returned HTML instead of JSON (Status ${res.status}). This usually means the route doesn't exist or there's a server error.`;
        } else {
          errorMessage = text;
        }
      } else {
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          errorMessage = json.error || json.message || text;
        } catch {
          // Not JSON, use text as-is (but limit length)
          errorMessage = text.length > 200 ? text.substring(0, 200) + "..." : text || res.statusText;
        }
      }
      
      // Check if user's membership was revoked (removed from organization)
      if (res.status === 403 && errorMessage.includes("No organization membership found")) {
        // Store a flag to indicate membership was revoked
        // The useMembershipRevocationHandler hook will detect and handle this
        sessionStorage.setItem("membershipRevoked", "true");
      }
    } catch (e) {
      // If we can't read the response, use status text
      errorMessage = res.statusText || "Unknown error";
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Safely coerce all segments to strings before joining
    const url = queryKey.map(String).join("/");
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
