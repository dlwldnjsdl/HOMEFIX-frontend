import type { PageResult, Photo, Request, WorkItem } from '../types/models';
export const fieldCodes = ['PLUMBING', 'DOORS_WINDOWS', 'WALLS_WALLPAPER', 'ELECTRICAL', 'APPLIANCES'] as const;
export const fieldNames = ['수도·배관', '문·창호', '벽·도배', '전기·조명', '생활가전'];
export const fieldImages = ['category-plumbing.webp', 'category-doors.webp', 'category-walls.webp', 'category-electrical.webp', 'category-appliances.webp'];
export const standardWorkTypes = ['수전 교체', '미닫이문 수리', '창문 잠금장치 교체', '벽지 물자국 점검', '벽지 보수', '조명 교체', '세탁기 배수 점검'] as const;
export const fieldLabel = (code?: string) => fieldNames[fieldCodes.indexOf(code as typeof fieldCodes[number])] || code || '분야 미정';
export const money = (value: unknown) => `${Number(value || 0).toLocaleString('ko-KR')}원`;
export const day = (input?: string) => input ? new Date(input).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }) : '날짜 미정';
export const datetime = (input?: string) => input ? new Date(input).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '일정 미정';
export const statusLabel = (status?: string) => ({
    ACTIVE: '진행 중',
    OPEN: '진행 중',
    CLOSED: '종료',
    NEEDS_CONFIRMATION: '확인 필요',
    EXPLORING: '기사 탐색',
    SELF_HELP: '셀프 수리',
    MANUFACTURER_AS: '공식 AS',
    RESERVED: '예약 확정',
    IN_PROGRESS: '작업 진행',
    STOP_REQUESTED: '중단 요청',
    COMPLETED: '완료',
    RESOLVED: '해결 완료',
    CANCELLED: '취소',
    STOPPED: '작업 중단',
    ACCEPTED: '수락',
    REJECTED: '거절',
    PENDING: '대기 중',
    FAILED: '실패',
    SUCCEEDED: '완료',
    READY: '준비 완료',
    CONFIRMED: '확인 완료',
    DRAFT: '초안',
    NEEDS_UPDATE: '재확인 필요',
    STALE: '갱신 필요',
    MATCHED: '방문 가능',
    NOT_MATCHED: '시간 불일치',
    UNKNOWN: '미확인',
    CHANGED: '변화 관찰',
    UNCHANGED: '변화 없음',
    INCOMPARABLE: '비교 불가',
    NOT_PERFORMED: '미수행',
    AVAILABLE: '이용 가능',
    INFORMATION_REQUIRED: '제품 정보 필요',
    NOT_REGISTERED: '미등록',
    NOT_APPLICABLE: '해당 없음',
    VALIDATION_FAILED: '검증 실패',
    MOCK: '모의 사례',
    REPRODUCED: '재현 자료',
} as Record<string, string>)[status || ''] || status || '진행 중';
export function itemsOf<T>(value: unknown): T[] {
    if (Array.isArray(value))
        return value as T[];
    const x = value as PageResult<T> | null;
    return Array.isArray(x?.items) ? x.items : [];
}
export function firstWork(request?: Request | null): WorkItem | undefined { return request?.workItems?.[0]; }
export function allPhotos(request?: Request | null): Photo[] {
    if (!request?.photos)
        return [];
    return [...(request.photos.confirmedDatePhotos || []), ...((request.photos.unknownDatePhotos || request.photos.unconfirmedDatePhotos) || [])];
}
export const maxPhotoCount = 5;
export function assertPhotos(files: File[], existing = 0) {
    if (!files.length || files.length + existing > maxPhotoCount) {
        throw Error(`사진은 한 번에 1~${maxPhotoCount}장까지 선택할 수 있어요.`);
    }
    for (const file of files) {
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            throw Error('JPG·PNG 사진만 등록할 수 있어요.');
        }
        if (file.size > 10000000) {
            throw Error('사진은 파일당 10MB 이하여야 해요.');
        }
    }
}
export function id(value: string) { return encodeURIComponent(value); }
export function safeExternalContact(value: string) {
    const v = value.trim();
    if (/^\+?[0-9\s()-]{7,}$/.test(v))
        return `tel:${v.replace(/[^+0-9]/g, '')}`;
    if (/^https:\/\//i.test(v))
        return v;
    return null;
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
/** Next occurrence strictly after today (JS weekday: 0=Sun .. 4=Thu .. 6=Sat). */
export function nextWeekdayDate(weekday: number) {
    const base = new Date(`${today()}T00:00:00+09:00`);
    const delta = (weekday - base.getUTCDay() + 7) % 7 || 7;
    const target = new Date(base.getTime() + delta * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(target);
}
export function seoulDatePart(input?: string | null) {
    if (!input)
        return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(input));
}
export function seoulTimePart(input?: string | null) {
    if (!input)
        return '';
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(input));
}
export function seoulDateTimeLocal(input?: string | null) {
    if (!input)
        return '';
    return `${seoulDatePart(input)}T${seoulTimePart(input)}`;
}
export function seoulIso(dateStr: string, timeStr: string) {
    return `${dateStr}T${timeStr.slice(0, 5)}:00+09:00`;
}
export function localToSeoulIso(dateTimeLocal: string) {
    if (!dateTimeLocal)
        return '';
    const [d, t] = dateTimeLocal.split('T');
    return `${d}T${(t || '00:00').slice(0, 5)}:00+09:00`;
}
