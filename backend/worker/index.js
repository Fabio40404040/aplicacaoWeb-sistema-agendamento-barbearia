const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const COLLECTIONS = new Set([
  "services",
  "promotions",
  "appointments",
  "blocks",
  "waitlist",
]);

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });

const cleanText = (value, max = 120) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const overlaps = (start, duration, rangeStart, rangeEnd) =>
  start < rangeEnd && start + duration > rangeStart;

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Response("Conteúdo inválido.", { status: 415 });
  }
  try {
    return await request.json();
  } catch {
    throw new Response("JSON inválido.", { status: 400 });
  }
}

function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    throw new Response("Origem não permitida.", { status: 403 });
  }
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value),
  );
}

function encodeBase64Url(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

async function createSession(email, secret) {
  const payload = encodeBase64Url(
    JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 }),
  );
  return `${payload}.${encodeBase64Url(await hmac(payload, secret))}`;
}

async function sessionFromRequest(request, env) {
  const token = parseCookies(request).frs_session;
  if (!token || !env.SESSION_SECRET) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = encodeBase64Url(await hmac(payload, env.SESSION_SECRET));
  if (!safeEqual(signature, expected)) return null;
  try {
    const session = JSON.parse(decodeBase64Url(payload));
    if (session.exp < Date.now() || session.email !== env.ADMIN_EMAIL) return null;
    return session;
  } catch {
    return null;
  }
}

async function requireAdmin(request, env) {
  const session = await sessionFromRequest(request, env);
  if (!session) throw new Response("Não autorizado.", { status: 401 });
  return session;
}

async function listServices(env, onlyActive = false) {
  const query = `SELECT id, name, duration, price, category, active FROM services${onlyActive ? " WHERE active = 1" : ""} ORDER BY id`;
  const { results } = await env.DB.prepare(query).all();
  return results.map((item) => ({ ...item, active: Boolean(item.active) }));
}

async function getAdminState(env) {
  const [services, appointments, blocks, promotions, waitlist] =
    await Promise.all([
      listServices(env),
      env.DB.prepare("SELECT * FROM appointments ORDER BY date, time").all(),
      env.DB.prepare("SELECT * FROM blocks ORDER BY date, start").all(),
      env.DB.prepare("SELECT * FROM promotions ORDER BY id").all(),
      env.DB.prepare("SELECT * FROM waitlist ORDER BY date, time").all(),
    ]);
  return {
    services,
    appointments: appointments.results.map((item) => ({
      id: item.id,
      client: item.client_name,
      phone: item.client_phone || "",
      service: item.service_name,
      duration: item.duration,
      date: item.date,
      time: item.time,
      status: item.status,
      createdAt: item.created_at,
    })),
    blocks: blocks.results.map((item) => ({
      id: item.id,
      date: item.date,
      allDay: Boolean(item.all_day),
      start: item.start || "",
      end: item.end || "",
      reason: item.reason,
    })),
    promotions: promotions.results.map((item) => ({
      ...item,
      active: Boolean(item.active),
    })),
    waitlist: waitlist.results.map((item) => ({
      id: item.id,
      client: item.client_name,
      phone: item.client_phone || "",
      service: item.service,
      date: item.date,
      time: item.time,
      createdAt: item.created_at,
    })),
  };
}

function statementsForCollection(env, collection, items) {
  const statements = [];
  if (collection === "services") {
    statements.push(env.DB.prepare("DELETE FROM services"));
    items.forEach((item) =>
      statements.push(
        env.DB.prepare(
          "INSERT INTO services (id, name, duration, price, category, active) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(
          Number(item.id),
          cleanText(item.name, 80),
          Number(item.duration),
          Number(item.price),
          cleanText(item.category, 40),
          item.active ? 1 : 0,
        ),
      ),
    );
  }
  if (collection === "promotions") {
    statements.push(env.DB.prepare("DELETE FROM promotions"));
    items.forEach((item) =>
      statements.push(
        env.DB.prepare(
          "INSERT INTO promotions (id, title, service, price, start, end, active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          Number(item.id),
          cleanText(item.title, 80),
          cleanText(item.service, 80),
          Number(item.price),
          item.start,
          item.end,
          item.active ? 1 : 0,
        ),
      ),
    );
  }
  if (collection === "blocks") {
    statements.push(env.DB.prepare("DELETE FROM blocks"));
    items.forEach((item) =>
      statements.push(
        env.DB.prepare(
          "INSERT INTO blocks (id, date, all_day, start, end, reason) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(
          Number(item.id),
          item.date,
          item.allDay ? 1 : 0,
          item.start || null,
          item.end || null,
          cleanText(item.reason, 120),
        ),
      ),
    );
  }
  if (collection === "waitlist") {
    statements.push(env.DB.prepare("DELETE FROM waitlist"));
    items.forEach((item) =>
      statements.push(
        env.DB.prepare(
          "INSERT INTO waitlist (id, client_name, client_phone, service, date, time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          Number(item.id),
          cleanText(item.client, 80),
          cleanText(item.phone, 24) || null,
          cleanText(item.service, 80),
          item.date,
          item.time,
          item.createdAt || new Date().toISOString(),
        ),
      ),
    );
  }
  if (collection === "appointments") {
    statements.push(env.DB.prepare("DELETE FROM appointment_slots"));
    statements.push(env.DB.prepare("DELETE FROM appointments"));
    items.forEach((item) => {
      statements.push(
        env.DB.prepare(
          "INSERT INTO appointments (id, client_name, client_phone, service_name, duration, date, time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          String(item.id),
          cleanText(item.client, 80),
          cleanText(item.phone, 24) || null,
          cleanText(item.service, 80),
          Number(item.duration),
          item.date,
          item.time,
          ["pending", "confirmed", "cancelled"].includes(item.status)
            ? item.status
            : "pending",
          item.createdAt || new Date().toISOString(),
        ),
      );
      if (item.status !== "cancelled") {
        const start = toMinutes(item.time);
        for (let minute = start; minute < start + Number(item.duration); minute += 15) {
          statements.push(
            env.DB.prepare(
              "INSERT INTO appointment_slots (appointment_id, date, slot) VALUES (?, ?, ?)",
            ).bind(String(item.id), item.date, toTime(minute)),
          );
        }
      }
    });
  }
  return statements;
}

async function replaceCollection(request, env, collection) {
  if (!COLLECTIONS.has(collection)) {
    return json({ error: "Coleção inválida." }, 404);
  }
  const body = await readBody(request);
  if (!Array.isArray(body.items) || body.items.length > 5000) {
    return json({ error: "Dados inválidos." }, 400);
  }
  const statements = statementsForCollection(env, collection, body.items);
  if (statements.length) await env.DB.batch(statements);
  return json({ ok: true });
}

async function publicAvailability(url, env) {
  const date = url.searchParams.get("date") || "";
  if (!validDate(date)) return json({ error: "Data inválida." }, 400);
  const [appointments, blocks] = await Promise.all([
    env.DB.prepare(
      "SELECT time, duration FROM appointments WHERE date = ? AND status != 'cancelled' ORDER BY time",
    )
      .bind(date)
      .all(),
    env.DB.prepare(
      "SELECT all_day, start, end FROM blocks WHERE date = ? ORDER BY start",
    )
      .bind(date)
      .all(),
  ]);
  return json({
    appointments: appointments.results,
    blocks: blocks.results.map((item) => ({
      allDay: Boolean(item.all_day),
      start: item.start,
      end: item.end,
    })),
  });
}

async function createAppointment(request, env) {
  assertSameOrigin(request);
  const body = await readBody(request);
  const client = cleanText(body.name, 80);
  const phone = cleanText(body.phone, 24);
  const phoneDigits = phone.replace(/\D/g, "");
  const serviceName = cleanText(body.service, 80);
  const date = cleanText(body.date, 10);
  const time = cleanText(body.time, 5);
  if (
    client.length < 2 ||
    !/^\d{10,11}$/.test(phoneDigits) ||
    !validDate(date) ||
    !validTime(time) ||
    date < todayInFortaleza()
  ) {
    return json({ error: "Preencha os dados do agendamento corretamente." }, 400);
  }
  const service = await env.DB.prepare(
    "SELECT name, duration FROM services WHERE name = ? AND active = 1",
  )
    .bind(serviceName)
    .first();
  if (!service) return json({ error: "Serviço indisponível." }, 400);

  const start = toMinutes(time);
  if (start < 7 * 60 || start > 20 * 60 || start % 60 !== 0) {
    return json({ error: "Horário inválido." }, 400);
  }
  const blocks = await env.DB.prepare(
    "SELECT all_day, start, end FROM blocks WHERE date = ?",
  )
    .bind(date)
    .all();
  const blocked = blocks.results.some(
    (block) =>
      block.all_day ||
      overlaps(
        start,
        service.duration,
        toMinutes(block.start),
        toMinutes(block.end),
      ),
  );
  if (blocked) return json({ error: "Este horário está bloqueado." }, 409);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      "INSERT INTO appointments (id, client_name, client_phone, service_name, duration, date, time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
    ).bind(
      id,
      client,
      phoneDigits,
      service.name,
      service.duration,
      date,
      time,
      createdAt,
    ),
  ];
  for (let minute = start; minute < start + service.duration; minute += 15) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO appointment_slots (appointment_id, date, slot) VALUES (?, ?, ?)",
      ).bind(id, date, toTime(minute)),
    );
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (
      String(error).includes("UNIQUE") ||
      String(error).includes("constraint")
    ) {
      return json({ error: "Esse horário acabou de ser reservado." }, 409);
    }
    throw error;
  }
  return json({ id, status: "pending" }, 201);
}

async function createWaitlistEntry(request, env) {
  assertSameOrigin(request);
  const body = await readBody(request);
  const client = cleanText(body.name, 80);
  const phoneDigits = cleanText(body.phone, 24).replace(/\D/g, "");
  const serviceName = cleanText(body.service, 80);
  const date = cleanText(body.date, 10);
  const time = cleanText(body.time, 5);
  if (
    client.length < 2 ||
    !/^\d{10,11}$/.test(phoneDigits) ||
    !validDate(date) ||
    !validTime(time) ||
    date < todayInFortaleza()
  ) {
    return json({ error: "Preencha os dados da fila corretamente." }, 400);
  }

  const service = await env.DB.prepare(
    "SELECT name, duration FROM services WHERE name = ? AND active = 1",
  )
    .bind(serviceName)
    .first();
  if (!service) return json({ error: "Serviço indisponível." }, 400);

  const start = toMinutes(time);
  if (start < 7 * 60 || start > 20 * 60 || start % 60 !== 0) {
    return json({ error: "Horário inválido." }, 400);
  }
  const [appointments, blocks] = await Promise.all([
    env.DB.prepare(
      "SELECT time, duration FROM appointments WHERE date = ? AND status != 'cancelled'",
    )
      .bind(date)
      .all(),
    env.DB.prepare("SELECT all_day, start, end FROM blocks WHERE date = ?")
      .bind(date)
      .all(),
  ]);
  const blocked = blocks.results.some(
    (block) =>
      block.all_day ||
      overlaps(
        start,
        service.duration,
        toMinutes(block.start),
        toMinutes(block.end),
      ),
  );
  if (blocked) return json({ error: "Este horário está bloqueado." }, 409);

  const occupied = appointments.results.some((appointment) =>
    overlaps(
      start,
      service.duration,
      toMinutes(appointment.time),
      toMinutes(appointment.time) + appointment.duration,
    ),
  );
  if (!occupied) {
    return json(
      { error: "Esse horário está disponível. Faça o agendamento normal." },
      409,
    );
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO waitlist (client_name, client_phone, service, date, time, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        client,
        phoneDigits,
        service.name,
        date,
        time,
        new Date().toISOString(),
      )
      .run();
    return json({ id: result.meta.last_row_id, status: "waitlist" }, 201);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return json({ error: "Você já está na fila para esse horário." }, 409);
    }
    throw error;
  }
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  if (request.method === "GET" && pathname === "/api/services") {
    return json({ services: await listServices(env, true) });
  }
  if (request.method === "GET" && pathname === "/api/availability") {
    return publicAvailability(url, env);
  }
  if (request.method === "POST" && pathname === "/api/appointments") {
    return createAppointment(request, env);
  }
  if (request.method === "POST" && pathname === "/api/waitlist") {
    return createWaitlistEntry(request, env);
  }
  if (request.method === "POST" && pathname === "/api/auth/login") {
    assertSameOrigin(request);
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
      return json({ error: "Acesso administrativo ainda não configurado." }, 503);
    }
    const body = await readBody(request);
    const email = cleanText(body.email, 120).toLowerCase();
    const valid =
      safeEqual(email, String(env.ADMIN_EMAIL).toLowerCase()) &&
      safeEqual(body.password, env.ADMIN_PASSWORD);
    if (!valid) return json({ error: "E-mail ou senha incorretos." }, 401);
    const token = await createSession(email, env.SESSION_SECRET);
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return json(
      { authenticated: true },
      200,
      {
        "set-cookie": `frs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`,
      },
    );
  }
  if (request.method === "GET" && pathname === "/api/auth/session") {
    return json({
      authenticated: Boolean(await sessionFromRequest(request, env)),
    });
  }
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    assertSameOrigin(request);
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return json(
      { authenticated: false },
      200,
      {
        "set-cookie": `frs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
      },
    );
  }
  if (pathname.startsWith("/api/admin/")) {
    await requireAdmin(request, env);
    if (request.method === "GET" && pathname === "/api/admin/state") {
      return json(await getAdminState(env));
    }
    if (
      request.method === "PUT" &&
      pathname.startsWith("/api/admin/state/")
    ) {
      assertSameOrigin(request);
      return replaceCollection(request, env, pathname.split("/").pop());
    }
  }
  return json({ error: "Rota não encontrada." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set("x-content-type-options", "nosniff");
      response.headers.set("x-frame-options", "DENY");
      response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
      response.headers.set(
        "permissions-policy",
        "camera=(), microphone=(), geolocation=()",
      );
      response.headers.set(
        "content-security-policy",
        "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      );
      return response;
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(error);
      return json({ error: "Erro interno do servidor." }, 500);
    }
  },
};
