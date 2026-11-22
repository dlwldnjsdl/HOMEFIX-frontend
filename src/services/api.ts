/**
 * 고쳐야집 HTTP client — Backend API Specification v1.1.
 * The server owns authorization, state transitions, quota and schedule validation.
 * Never store session cookies or private data in localStorage.
 */
const BASE = ((window as Window & {
    FIXMYHOME_API_BASE?: string;
}).FIXMYHOME_API_BASE || '/api/v1').replace(/\/$/, '');
const unresolvedMutations = new Map<string, string>();
export class ApiError extends Error {
    code: string;
    retryable: boolean;
    details: Record<string, any>;
    constructor(message: string, public readonly status = 0, payload: Record<string, any> = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = payload.code || (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR');
        this.retryable = !!payload.retryable;
        this.details = payload;
    }
}
function keyForRequest(method: string, path: string, query?: Record<string, unknown>, body?: any) {
    let payload: unknown = '';
    if (body instanceof FormData) {
        payload = [...body.entries()].map(([k, v]) => [k, v instanceof File ? `${v.name}|${v.size}|${v.lastModified}|${v.type}` : String(v)]);
    }
    else
        payload = body;
    return JSON.stringify([method, path, query || {}, payload]);
}
function quotedKey() {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `"${id}"`;
}
function makeURL(path: string, query?: Record<string, unknown>) {
    if (!path.startsWith('/'))
        throw new Error('API 경로는 /로 시작해야 해요.');
    const url = new URL(BASE + path, location.origin);
    for (const [name, value] of Object.entries(query || {}))
        if (value !== null && value !== undefined && value !== '')
            url.searchParams.set(name, String(value));
    return url.pathname + url.search;
}
type InvokeOptions = {
    body?: any;
    query?: Record<string, unknown>;
    idempotent?: boolean;
    idempotencyKey?: string | null;
    binary?: boolean;
    signal?: AbortSignal;
};
async function invoke(method: string, path: string, { body, query, idempotent = false, idempotencyKey = null, binary = false, signal }: InvokeOptions = {}): Promise<any> {
    const form = body instanceof FormData;
    const headers: Record<string, string> = { Accept: binary ? '*/*' : 'application/json' };
    if (body !== undefined && body !== null && !form)
        headers['Content-Type'] = 'application/json';
    const fingerprint = idempotent ? keyForRequest(method, path, query, body) : '';
    if (idempotent)
        headers['Idempotency-Key'] = idempotencyKey || unresolvedMutations.get(fingerprint) || quotedKey();
    if (idempotent)
        unresolvedMutations.set(fingerprint, headers['Idempotency-Key']);
    let res;
    try {
        res = await fetch(makeURL(path, query), {
            method, credentials: 'include', headers, signal,
            body: body === undefined || body === null ? undefined : form ? body : JSON.stringify(body)
        });
    }
    catch (error) {
        // Keep the same idempotency key for deliberate retry of this identical request.
        throw new ApiError('서버에 연결하지 못했어요. 연결 상태를 확인하고 같은 작업을 다시 시도해 주세요.', 0, { code: 'NETWORK_ERROR', retryable: true });
    }
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        // Key reuse is only appropriate for pending / transient failure of the identical mutation.
        if (idempotent && !(payload.retryable && (res.status === 409 || res.status === 500 || res.status === 503)))
            unresolvedMutations.delete(fingerprint);
        const fields = Array.isArray(payload.fieldErrors) ? payload.fieldErrors.map((e: any) => e.field || e.path).filter(Boolean) : [];
        const message = payload.message || `요청을 완료하지 못했어요. (HTTP ${res.status})`;
        throw new ApiError(message + (fields.length ? ` · 입력 확인: ${fields.slice(0, 3).join(', ')}` : ''), res.status, payload);
    }
    if (idempotent)
        unresolvedMutations.delete(fingerprint);
    if (res.status === 204)
        return null;
    if (binary)
        return await res.blob();
    const value: any = await res.json().catch(() => null);
    return value && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value;
}
export const api = {
    get: (path: string, query?: Record<string, unknown>) => invoke('GET', path, { query }),
    post: (path: string, body?: unknown, idempotent = false) => invoke('POST', path, { body, idempotent }),
    put: (path: string, body?: unknown, idempotent = false) => invoke('PUT', path, { body, idempotent }),
    patch: (path: string, body?: unknown, idempotent = false) => invoke('PATCH', path, { body, idempotent }),
    delete: (path: string, body?: unknown, idempotent = false) => invoke('DELETE', path, { body, idempotent }),
    blob: (path: string) => invoke('GET', path, { binary: true }),
    form: (method: string, path: string, form: FormData, idempotent = false) => invoke(method, path, { body: form, idempotent }),
    upload: (path: string, files: File[], metadataName: string, metadata: unknown) => {
        const form = new FormData();
        files.forEach(file => form.append('files', file, file.name));
        form.append(metadataName, JSON.stringify(metadata));
        return invoke('POST', path, { body: form, idempotent: true });
    },
    signup: (loginId: string, password: string) => invoke('POST', '/auth/signup', { body: { loginId, password } }),
    login: (loginId: string, password: string) => invoke('POST', '/auth/login', { body: { loginId, password } }),
    logout: () => invoke('POST', '/auth/logout'),
    me: () => invoke('GET', '/auth/me'),
    role: (role: string) => invoke('PATCH', '/auth/role', { body: { role } }),
    publicTech: (query?: Record<string, unknown>) => invoke('GET', '/public/technicians', { query }),
    serviceInfo: () => invoke('GET', '/public/service-info'),
    publicGuidance: (type: string) => invoke('GET', '/public/guidance', { query: { type } }),
    requests: () => invoke('GET', '/requests'),
    request: (id: string) => invoke('GET', `/requests/${encodeURIComponent(id)}`),
    newRequest: (files: File[], metadata: unknown) => api.upload('/requests', files, 'metadata', metadata),
    editRequest: (id: string, revision: unknown, fields: Record<string, unknown>) => invoke('PATCH', `/requests/${encodeURIComponent(id)}`, { body: { expectedRevision: revision, ...fields } }),
    aiJob: (requestId: string, body: unknown) => invoke('POST', `/requests/${encodeURIComponent(requestId)}/ai-jobs`, { body, idempotent: true }),
    aiStatus: (jobId: string) => invoke('GET', `/ai-jobs/${encodeURIComponent(jobId)}`),
    aiHistory: (requestId: string) => invoke('GET', `/requests/${encodeURIComponent(requestId)}/ai-jobs`),
    aiAnswer: (requestId: string, body: unknown) => invoke('PUT', `/requests/${encodeURIComponent(requestId)}/ai-dialogue`, { body }),
    confirmWork: (id: string, body: unknown) => invoke('PUT', `/work-items/${encodeURIComponent(id)}/confirmation`, { body, idempotent: true }),
    workSolutions: (id: string) => invoke('GET', `/work-items/${encodeURIComponent(id)}/solutions`),
    caseRecommendations: (id: string) => invoke('GET', `/work-items/${encodeURIComponent(id)}/case-recommendations`),
    generalCandidates: (id: string, query?: Record<string, unknown>) => invoke('GET', `/work-items/${encodeURIComponent(id)}/general-candidates`, { query }),
    quotes: (id: string) => invoke('GET', `/work-items/${encodeURIComponent(id)}/quotes`),
    reservations: () => invoke('GET', '/reservations'),
    reservationCheck: (quoteId: string) => invoke('POST', '/reservation-checks', { body: { operation: 'CREATE', quoteId } }),
    technicianMe: () => invoke('GET', '/technicians/me'),
    consultations: () => invoke('GET', '/consultations'),
    deliveryList: (id: string) => invoke('GET', `/work-items/${encodeURIComponent(id)}/deliveries`),
    timeline: (id: string) => invoke('GET', `/requests/${encodeURIComponent(id)}/timeline`),
    report: (id: string) => invoke('GET', `/work-items/${encodeURIComponent(id)}/report`)
};
export const itemsOf = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
export function errorDescription(error: any): string {
    if (!(error instanceof ApiError))
        return error?.message || '요청을 완료하지 못했어요.';
    const guide: Record<string, string> = {
        VERSION_CONFLICT: '다른 변경 사항이 먼저 저장됐어요. 최신 내용을 다시 확인해 주세요.',
        STALE_SOURCE: '원본 자료가 변경됐어요. 공유·분석 내용을 다시 확인해 주세요.',
        INSUFFICIENT_INPUT: '먼저 필수 정보를 입력하고 확인해 주세요.',
        QUOTE_UNAVAILABLE: '이 견적은 현재 선택할 수 없어요. 최신 견적을 다시 확인해 주세요.',
        TECHNICIAN_CONFLICT: '기사님의 기존 일정과 겹쳐요. 다른 시간을 선택해 주세요.',
        ACCOUNT_EXISTS: '이미 사용 중인 아이디예요.',
        UNAUTHENTICATED: '로그인이 필요해요.',
        INVALID_CREDENTIALS: '아이디와 비밀번호를 다시 확인해 주세요.',
        SERVICE_UNSUPPORTED: '현재 지원하지 않는 지역 또는 수리 분야예요.',
        DELIVERY_NOT_CONFIRMED: '상담 전에 공유할 자료를 먼저 확인해 주세요.',
        IDEMPOTENCY_IN_PROGRESS: '이전 요청의 처리 결과를 확인 중이에요. 같은 작업을 다시 시도해 주세요.',
        REFERENCE_DATA_MISSING: '방문 가능 여부를 확인할 기준 자료가 부족해요.',
        SCHEDULE_RECHECK_REQUIRED: '기사 일정에 변경이 있어 다시 확인해야 해요.',
        ANALYSIS_NOT_SUPPORTED: '현재 사진 변화 분석은 벽지 물자국에만 지원돼요.'
    };
    const actions = (error.details?.requiredActions || []).slice(0, 2).map((x: any) => typeof x === 'string' ? x : x?.message || x?.action).filter(Boolean);
    return [guide[error.code] || error.message, ...actions].join(' ');
}
export async function invokeContract(method: string, path: string, opts: InvokeOptions = {}) {
    return invoke(method, path, {
        ...opts, idempotent: !!opts.idempotencyKey, idempotencyKey: opts.idempotencyKey
    });
}
