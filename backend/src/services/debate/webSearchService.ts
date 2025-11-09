import { WebSearchResult } from "../../types/debate.types";

/**
 * Performs a web search using Tavily API or returns a fallback message
 * @param query The search query
 * @param maxResults Maximum number of results to return (default: 5)
 * @returns Array of web search results
 */
export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  console.log(`[WebSearch] Searching for: "${query}"`);

  try {
    // If TAVILY_API_KEY is set, use real search
    if (process.env.TAVILY_API_KEY) {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: maxResults,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const results = data.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        }));
        console.log(`[WebSearch] Found ${results.length} results`);
        return results;
      } else {
        console.warn(`[WebSearch] API returned status ${response.status}`);
      }
    } else {
      console.warn("[WebSearch] TAVILY_API_KEY not configured");
    }

    // Fallback: return helpful message
    return [
      {
        title: "Web search not configured",
        url: "",
        snippet: `Web search for "${query}" requires TAVILY_API_KEY environment variable to be set. Using paper citations only.`,
      },
    ];
  } catch (error) {
    console.error("[WebSearch] Error:", error);
    return [
      {
        title: "Web search error",
        url: "",
        snippet: "Unable to perform web search at this time. Using paper citations only.",
      },
    ];
  }
}

