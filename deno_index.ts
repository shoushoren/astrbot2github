// 零依赖版 astrbot2github：去掉 deno.land/std 的 import，直接用内置 Deno.serve。
// 目的：Deno Deploy 构建/预热阶段不需要从 deno.land 拉任何东西，避免卡在 Warm up。
// 行为与上游一致：根路径返回提示文案；/<完整URL> 代理转发，服务端跟随重定向。
Deno.serve((req: Request): Response | Promise<Response> => {
  const incomingUrl = new URL(req.url);
  if (incomingUrl.pathname === "/") {
    return new Response(
      "此地址只用于为astrbot提供更快速的github访问服务",
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
  const targetUrlString = decodeURIComponent(incomingUrl.pathname.slice(1));
  if (!targetUrlString || (!targetUrlString.startsWith("http://") && !targetUrlString.startsWith("https://"))) {
    return new Response("Invalid or missing target URL in path. Usage: /<target_url>", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  console.log(`Proxying request to: ${targetUrlString}`);
  return (async () => {
    try {
      const response = await fetch(targetUrlString, {
        headers: req.headers,
        method: req.method,
        body: req.body,
        redirect: "follow",
      });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, *");
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error(`Error fetching ${targetUrlString}:`, error);
      return new Response(`Failed to proxy request to ${targetUrlString}: ${error.message}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })();
});
