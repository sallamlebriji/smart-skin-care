export type User = { id: string; email: string };
export type Tokens = { access_token: string; refresh_token: string; user: User };
export type SavedSession = { endpoint: string; refreshToken?: string };
export type SessionStore = { save: (value: SavedSession) => Promise<void> };
export type Scan = {
  scan_id: string; created_at: string; status: string;
  result?: { metrics: Record<string, number>; mock_metrics: string[]; confidence: number };
  wrinkle_assessment?: { label: string; wrinkle_probability: number; experimental: boolean; model: string };
};
export type Step = { order: number; name: string; reason?: string | null; frequency?: string | null };
export type Routine = { morning: Step[]; evening: Step[] };
export type Profile = { display_name: string; skin_type: string | null; goals: string[]; consent_data_use: boolean };
export type Conversation = { ai_available: boolean; messages: { id: string; role: string; content: string }[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function normalizeEndpoint(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname.replace(/\//g, '')) {
    throw new Error('Enter the server origin only, for example http://10.0.2.2:8001');
  }
  if (process.env.EXPO_PUBLIC_REQUIRE_HTTPS === 'true' && url.protocol !== 'https:') {
    throw new Error('This build requires an HTTPS API server.');
  }
  return url.origin;
}

/** Native bearer transport. A retired instance can never restore a signed-out session. */
export class MobileApi {
  private access = '';
  private refreshToken = '';
  private active = true;
  private closing = false;
  private rotating?: Promise<User>;
  constructor(
    readonly endpoint: string,
    private store: SessionStore,
    private expired: () => void,
    private transport: typeof fetch = (...args) => fetch(...args),
  ) {}

  private assertActive() { if (!this.active) throw new Error('Session closed. Sign in again.'); }

  private async raw<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await this.transport(`${this.endpoint}/api${path}`, {
        ...init, credentials: 'omit', signal: controller.signal,
        headers: { Accept: 'application/json', ...init.headers },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiError(response.status, typeof data.detail === 'string' ? data.detail : `Request failed (${response.status})`);
      }
      return response.status === 204 ? undefined as T : await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The server took too long. Retry from history before uploading again.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  private json(body: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  private async accept(tokens: Tokens): Promise<User> {
    this.assertActive();
    // Never publish credentials until the rotated refresh token is safely stored.
    await this.store.save({ endpoint: this.endpoint, refreshToken: tokens.refresh_token });
    this.assertActive();
    this.access = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    return tokens.user;
  }

  async authenticate(action: 'login' | 'register', email: string, password: string) {
    this.assertActive();
    return this.accept(await this.raw<Tokens>(`/mobile/auth/${action}`, this.json({ email, password })));
  }

  async restore(refreshToken: string) { this.refreshToken = refreshToken; return this.rotate(); }

  private rotate(): Promise<User> {
    this.assertActive();
    if (this.rotating) return this.rotating;
    if (!this.refreshToken) return Promise.reject(new ApiError(401, 'Sign in again.'));
    this.rotating = (async () => {
      try {
        return await this.accept(await this.raw<Tokens>('/mobile/auth/refresh', this.json({ refresh_token: this.refreshToken })));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && this.active) {
          await this.store.save({ endpoint: this.endpoint });
          this.active = false;
          this.access = this.refreshToken = '';
          this.expired();
        }
        throw error;
      } finally { this.rotating = undefined; }
    })();
    return this.rotating;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertActive();
    if (this.closing) throw new Error('Signing out. Please wait.');
    const accessAtStart = this.access;
    const send = () => this.raw<T>(path, { ...init, headers: {
      ...init.headers, Authorization: `Bearer ${this.access}`, 'X-Account-Session': 'true',
    } });
    try { const result = await send(); this.assertActive(); return result; }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      this.assertActive();
      if (this.closing) throw new Error('Signing out. Please wait.');
      // Concurrent 401s share one rotation; late responses reuse the new access token.
      if (this.access === accessAtStart) await this.rotate();
      const result = await send(); this.assertActive(); return result;
    }
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, body === undefined ? { method: 'POST' } : this.json(body));
  }
  put<T>(path: string, body: unknown) { return this.request<T>(path, { ...this.json(body), method: 'PUT' }); }

  async logout() {
    this.closing = true;
    try {
      // Finish an in-flight rotation before revoking its replacement, then retire this client.
      await this.rotating?.catch(() => {});
      if (this.refreshToken) await this.raw('/mobile/auth/logout', this.json({ refresh_token: this.refreshToken }));
      await this.store.save({ endpoint: this.endpoint });
      this.active = false;
      this.access = this.refreshToken = '';
    } finally { this.closing = false; }
  }
}

export function measuredMetrics(scan: Scan): Record<string, number> {
  const result = scan.result;
  return Object.fromEntries(Object.entries(result?.metrics ?? {}).filter(([key]) => !result?.mock_metrics.includes(key)));
}

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}
