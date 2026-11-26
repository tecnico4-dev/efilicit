/**
 * Cliente Supabase encadenable para tests unitarios (sin red).
 * Registra llamadas y permite programar `{ data, error }` por tabla/método.
 */

export type FakeSupabaseResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

type CallRecord = {
  table: string;
  method: string;
  args: unknown[];
  filters: Array<{ op: string; args: unknown[] }>;
};

type TableScript = {
  /** Resultado por defecto de cualquier terminal (select/insert/…). */
  default?: FakeSupabaseResult;
  /** Resultado por método terminal (`select`, `insert`, `upsert`, …). */
  byMethod?: Record<string, FakeSupabaseResult | FakeSupabaseResult[]>;
};

type RpcScript = FakeSupabaseResult | FakeSupabaseResult[];

function okResult(data: unknown = null): FakeSupabaseResult {
  return { data, error: null };
}

function takeResult(
  value: FakeSupabaseResult | FakeSupabaseResult[] | undefined,
  fallback: FakeSupabaseResult = okResult(null),
): FakeSupabaseResult {
  if (value === undefined) return fallback;
  if (Array.isArray(value)) {
    if (value.length === 0) return fallback;
    return value.shift() ?? fallback;
  }
  return value;
}

export function createFakeSupabaseClient(options?: {
  tables?: Record<string, TableScript>;
  rpc?: Record<string, RpcScript>;
  authUser?: { id: string } | null;
}) {
  const scripts = options?.tables ?? {};
  const rpcScripts = options?.rpc ?? {};
  const calls: CallRecord[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];

  function resolve(table: string, method: string): FakeSupabaseResult {
    const script = scripts[table];
    if (!script) return okResult(null);
    if (script.byMethod?.[method] !== undefined) {
      return takeResult(script.byMethod[method]);
    }
    if (script.default !== undefined) return takeResult(script.default);
    return okResult(null);
  }

  function makeBuilder(table: string) {
    const filters: Array<{ op: string; args: unknown[] }> = [];
    let pendingMethod = "select";
    let pendingArgs: unknown[] = [];

    const builder: Record<string, unknown> = {};

    const chainOps = [
      "select",
      "insert",
      "upsert",
      "update",
      "delete",
      "eq",
      "neq",
      "in",
      "is",
      "not",
      "gte",
      "lte",
      "gt",
      "lt",
      "order",
      "limit",
      "range",
      "or",
      "match",
      "filter",
    ] as const;

    const writeOps = new Set(["insert", "upsert", "update", "delete"]);

    for (const op of chainOps) {
      builder[op] = (...args: unknown[]) => {
        if (writeOps.has(op)) {
          // Terminal write; `.select()` posterior solo pide columnas de retorno.
          pendingMethod = op;
          pendingArgs = args;
        } else if (op === "select") {
          if (!writeOps.has(pendingMethod)) {
            pendingMethod = "select";
            pendingArgs = args;
          }
        } else {
          filters.push({ op, args });
        }
        return builder;
      };
    }

    const finish = async (method = pendingMethod) => {
      calls.push({
        table,
        method,
        args: pendingArgs,
        filters: [...filters],
      });
      const result = resolve(table, method);
      return {
        data: result.data ?? null,
        error: result.error ?? null,
      };
    };

    builder.single = async () => finish(pendingMethod);
    builder.maybeSingle = async () => finish(pendingMethod);

    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => finish().then(onFulfilled, onRejected);

    return builder;
  }

  return {
    calls,
    rpcCalls,
    from(table: string) {
      return makeBuilder(table);
    },
    async rpc(name: string, args?: unknown) {
      rpcCalls.push({ name, args });
      const result = takeResult(rpcScripts[name]);
      return {
        data: result.data ?? null,
        error: result.error ?? null,
      };
    },
    auth: {
      async getUser() {
        const user = options?.authUser ?? null;
        if (!user) {
          return { data: { user: null }, error: { message: "No hay sesión" } };
        }
        return { data: { user }, error: null };
      },
    },
    callsFor(table: string) {
      return calls.filter((c) => c.table === table);
    },
  };
}

export type FakeSupabaseClient = ReturnType<typeof createFakeSupabaseClient>;
