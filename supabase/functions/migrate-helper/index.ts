import "@supabase/functions-js/edge-runtime.d.ts";

export default {
  fetch: () => new Response(null, { status: 204 }),
};
