import type { PageResult, Photo, Request, WorkItem } from '../types/models';
export const fieldCodes = ['PLUMBING', 'DOORS_WINDOWS', 'WALLS_WALLPAPER', 'ELECTRICAL', 'APPLIANCES'] as const;
export const fieldNames = ['수도·배관', '문·창호', '벽·도배', '전기·조명', '생활가전'];
export const fieldImages = ['category-plumbing.webp', 'category-doors.webp', 'category-walls.webp', 'category-electrical.webp', 'category-appliances.webp'];
export const fieldLabel = (code?: string) => fieldNames[fieldCodes.indexOf(code as typeof fieldCodes[number])] || code || '분야 미정';
export const money = (value: unknown) => `${Number(value || 0).toLocaleString('ko-KR')}원`;
export const day = (input?: string) => input ? new Date(input).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }) : '날짜 미정';
export const datetime = (input?: string) => input ? new Date(input).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '일정 미정';
export const statusLabel = (status?: string) => ({ ACTIVE: '진행 중', OPEN: '진행 중', CLOSED: '종료', NEEDS_CONFIRMATION: '확인 필요', EXPLORING: '기사 탐색', SELF_HELP: '셀프 수리', MANUFACTURER_AS: '공식 AS', RESERVED: '예약 확정', IN_PROGRESS: '작업 진행', STOP_REQUESTED: '중단 요청', COMPLETED: '완료', RESOLVED: '해결 완료', CANCELLED: '취소', ACCEPTED: '수락', PENDING: '대기 중', FAILED: '실패', SUCCEEDED: '완료', CONFIRMED: '확인 완료' } as Record<string, string>)[status || ''] || status || '진행 중';
export function itemsOf<T>(value: unknown): T[] { if (Array.isArray(value))
    return value as T[]; const x = value as PageResult<T> | null; return Array.isArray(x?.items) ? x.items : []; }
export function firstWork(request?: Request | null): WorkItem | undefined { return request?.workItems?.[0]; }
export function allPhotos(request?: Request | null): Photo[] { if (!request?.photos)
    return []; return [...(request.photos.confirmedDatePhotos || []), ...((request.photos.unknownDatePhotos || request.photos.unconfirmedDatePhotos) || [])]; }
export function assertPhotos(files: File[], existing = 0) { if (!files.length || files.length + existing > 5)
    throw Error('사진은 한 번에 1~5장까지 선택할 수 있어요.'); for (const f of files) {
    if (!['image/jpeg', 'image/png'].includes(f.type))
        throw Error('JPG·PNG 사진만 등록할 수 있어요.');
    if (f.size > 10000000)
        throw Error('사진은 파일당 10MB 이하여야 해요.');
} }
export function id(value: string) { return encodeURIComponent(value); }
export function safeExternalContact(value: string) { const v = value.trim(); if (/^\+?[0-9\s()-]{7,}$/.test(v))
    return `tel:${v.replace(/[^+0-9]/g, '')}`; if (/^https:\/\//i.test(v))
    return v; return null; }
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
