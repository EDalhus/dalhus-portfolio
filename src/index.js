/**
 * Cloudflare Worker for dalhus-portfolio.
 *
 * Alt i ./public serveres rett fra Cloudflares edge av asset-laget, uten at
 * denne Worker-en kjører. Sikkerhetsheaderne for de statiske filene settes i
 * ./public/_headers.
 *
 * Worker-en kjører for ruter som ikke matcher en fil — i praksis /api/* og
 * /healthz.
 */
import { handleSmugmugRequest } from "./smugmug.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/smugmug") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
      }
      return handleSmugmugRequest(request, env, ctx);
    }

    // Alt annet: la asset-laget svare (inkludert 404-siden).
    return env.ASSETS.fetch(request);
  },
};
