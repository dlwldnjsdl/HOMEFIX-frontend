import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { day, fieldLabel, firstWork, money, statusLabel, allPhotos } from '../lib/format';
import type { Request, Technician, Photo } from '../types/models';
export type RegionBox = {
    photoId: string;
    width: number;
    height: number;
    box: [number, number, number, number];
    description?: string;
};
export function Icon({ name, size = 21, className = '' }: {
    name: string;
    size?: number;
    className?: string;
}) {
    const paths: Record<string, ReactNode> = { home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 21v-7h6v7"/></>, camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/></>, search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>, file: <><path d="M5 2h9l5 5v15H5zM14 2v5h5M8 12h8M8 16h8"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-9 16-9 16 0"/></>, back: <path d="M19 12H5m6-6-6 6 6 6"/>, arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>, chevron: <path d="m9 5 7 7-7 7"/>, spark: <><path d="m12 2 2 7 7 3-7 2-2 7-2-7-7-2 7-3z"/><path d="M20 3v4m-2-2h4"/></>, tool: <path d="M21 6a7 7 0 0 1-9 8l-8 8-3-3 8-8a7 7 0 0 1 8-9l-4 4 5 5z"/>, shield: <><path d="m12 2 9 4v6c0 6-3 9-9 10-6-1-9-4-9-10V6z"/><path d="m8 12 3 3 5-6"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>, pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></>, check: <path d="m4 12 5 5L20 6"/>, close: <path d="m5 5 14 14M19 5 5 19"/>, refresh: <path d="M20 7V3l-4 4M20 7a8 8 0 0 0-15-3m-1 13v4l4-4m-4 0a8 8 0 0 0 15 3"/>, info: <><circle cx="12" cy="12" r="10"/><path d="M12 11v7m0-11h.01"/></>, download: <path d="M12 3v14m-5-5 5 5 5-5M3 21h18"/>, edit: <path d="m4 17 12-12 4 4L8 21H4z"/>, phone: <path d="M6 3c-3 1-2 5 2 10s9 9 13 6l-4-5-3 3-7-7 3-3z"/>, alert: <><path d="m12 2 10 19H2z"/><path d="M12 8v6m0 4h.01"/></>, map: <><path d="m3 4 6-2 6 2 6-2v18l-6 2-6-2-6 2z"/><path d="M9 2v18m6-16v18"/></>, chat: <path d="M20 11a8 8 0 0 1-11 8l-6 2 2-6A8 8 0 1 1 20 11z"/>, filter: <path d="M3 6h18M7 12h10m-7 6h4"/>, plus: <path d="M12 5v14M5 12h14"/>, photo: <><rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 19 6-6 4 4 3-3 5 5"/></>, headset: <><path d="M3 14V12a9 9 0 0 1 18 0v2M4 14h3v6H4zm13 0h3v6h-3z"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0v6l-3 4h18l-3-4zM10 21h4"/></> };
    return <svg className={`rx-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>;
}
export function PageHeader({ title, back = true, right }: {
    title: string;
    back?: boolean;
    right?: ReactNode;
}) { const { back: goBack, navigate } = useApp(); return <header className="rx-screenhead">{back ? <button className="rx-iconbtn" onClick={goBack} aria-label="뒤로가기"><Icon name="back"/></button> : <button className="rx-iconbtn" onClick={() => navigate('home')}><Icon name="home"/></button>}<h1>{title}</h1><span className="rx-header-right">{right}</span></header>; }
export function Section({ title, detail, children, action }: {
    title: string;
    detail?: string;
    children: ReactNode;
    action?: ReactNode;
}) { return <section className="rx-section"><div className="rx-section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>{children}</section>; }
export function ScreenIntro({ tag, title, subtitle, illustration, tone = 'rose' }: {
    tag: string;
    title: string;
    subtitle?: string;
    illustration?: string;
    tone?: string;
}) { return <div className={`rx-intro rx-tone-${tone}`}><div><span className="rx-overline">{tag}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{illustration && <img src={`/assets/${illustration}`} alt=""/>}</div>; }
export function Empty({ icon = 'info', title, detail, action }: {
    icon?: string;
    title: string;
    detail: string;
    action?: ReactNode;
}) { return <div className="rx-empty"><div className="rx-empty-icon"><Icon name={icon} size={34}/></div><h3>{title}</h3><p>{detail}</p>{action}</div>; }
export function ErrorState({ message, onRetry }: {
    message: string;
    onRetry?: () => void;
}) { return <div className="rx-error"><Icon name="alert"/><span>{message}</span>{onRetry && <button className="rx-link" onClick={onRetry}>다시 시도</button>}</div>; }
export function Spinner({ text = '불러오는 중이에요' }: {
    text?: string;
}) { return <div className="rx-loading"><span className="rx-spinner"/>{text}</div>; }
export function Tag({ children, tone = 'rose' }: {
    children: ReactNode;
    tone?: string;
}) { return <span className={`rx-tag rx-tag-${tone}`}>{children}</span>; }
export function Button({ children, onClick, kind = 'primary', disabled = false, type = 'button' }: {
    children: ReactNode;
    onClick?: () => void;
    kind?: 'primary' | 'secondary' | 'outline' | 'ghost';
    disabled?: boolean;
    type?: 'button' | 'submit';
}) { return <button type={type} disabled={disabled} className={`rx-btn rx-btn-${kind}`} onClick={onClick}>{children}</button>; }
export function MediaImage({ photo, mediaId, alt = '', className = '' }: {
    photo?: Photo | null;
    mediaId?: string | null;
    alt?: string;
    className?: string;
}) {
    const resolvedId = mediaId || photo?.media?.mediaId || null;
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        let valid = true;
        let objectUrl: string | null = null;
        if (resolvedId) {
            api.blob(`/media/${encodeURIComponent(resolvedId)}`).then((blob: Blob) => {
                objectUrl = URL.createObjectURL(blob);
                if (valid)
                    setUrl(objectUrl);
            }).catch(() => {
                if (valid)
                    setUrl(null);
            });
        }
        else {
            setUrl(null);
        }
        return () => {
            valid = false;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [resolvedId]);
    return url ? <img className={className} src={url} alt={alt}/> : <div className={`rx-photo-placeholder ${className}`}><Icon name="home" size={27}/></div>;
}
export function AnnotatedPhoto({ photo, mediaId, alt = '', regions = [], caption }: {
    photo?: Photo | null;
    mediaId?: string | null;
    alt?: string;
    regions?: RegionBox[];
    caption?: string;
}) {
    return <figure className="rx-annotated-wrap">
        <div className="rx-annotated">
            <MediaImage photo={photo} mediaId={mediaId} alt={alt} className="rx-annotated-img"/>
            {regions.map((region, idx) => {
                const [x1, y1, x2, y2] = region.box;
                return <div key={idx} className="rx-bbox" style={{
                    left: `${x1 * 100}%`,
                    top: `${y1 * 100}%`,
                    width: `${(x2 - x1) * 100}%`,
                    height: `${(y2 - y1) * 100}%`,
                }} title={region.description || `변화 영역 #${idx + 1}`}>
                    <span className="rx-bbox-label">#{idx + 1}</span>
                </div>;
            })}
        </div>
        {caption && <figcaption className="rx-muted">{caption}</figcaption>}
        {regions.map((region, idx) => region.description ? <p key={idx} className="rx-bbox-note">영역 #{idx + 1}: {region.description}</p> : null)}
    </figure>;
}
export function MarkdownView({ markdown }: { markdown?: string | null }) {
    if (!markdown?.trim())
        return <p className="rx-muted">아직 작성된 본문이 없어요.</p>;
    const lines = markdown.split(/\r?\n/);
    function renderInline(text: string) {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, idx) => part.startsWith('**') && part.endsWith('**') ? <strong key={idx}>{part.slice(2, -2)}</strong> : part);
    }
    return <div className="rx-md">{lines.map((raw, idx) => {
        const line = raw.trimEnd();
        if (!line.trim())
            return <div key={idx} className="rx-md-gap"/>;
        if (line.startsWith('### '))
            return <h4 key={idx}>{renderInline(line.slice(4))}</h4>;
        if (line.startsWith('## '))
            return <h3 key={idx}>{renderInline(line.slice(3))}</h3>;
        if (line.startsWith('# '))
            return <h2 key={idx}>{renderInline(line.slice(2))}</h2>;
        if (/^[-*+]\s+/.test(line))
            return <p key={idx} className="rx-md-li">• {renderInline(line.replace(/^[-*+]\s+/, ''))}</p>;
        return <p key={idx}>{renderInline(line)}</p>;
    })}</div>;
}
export function RequestCard({ request }: {
    request: Request;
}) { const { navigate } = useApp(); const work = firstWork(request); const photo = allPhotos(request)[0]; return <button className="rx-request-card" onClick={() => navigate('detail', request.requestId)}><MediaImage photo={photo} className="rx-thumb"/><span className="rx-request-copy"><span className="rx-meta">{day(request.updatedAt)} · {fieldLabel(work?.facts?.fields?.[0])}</span><strong>{request.symptom}</strong><span className="rx-state-line">{statusLabel(work?.status || request.status)} · 요청 상세 보기</span></span><Icon name="chevron" size={18}/></button>; }
export function TechnicianCard({ expert, onOpen }: {
    expert: Technician;
    onOpen: () => void;
}) { return <button className="rx-technician-card" onClick={onOpen}><div className="rx-expert-avatar"><Icon name="tool" size={26}/></div><span><strong>{expert.displayName || '기사'}</strong><small>{expert.fields?.map(fieldLabel).join(' · ') || '분야 확인'} · {expert.regions?.[0]?.district || '지역 확인'}</small></span><Icon name="chevron"/></button>; }
export function MoneyRow({ label, value, accent = false }: {
    label: string;
    value: unknown;
    accent?: boolean;
}) { return <div className={`rx-moneyrow ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{money(value)}</strong></div>; }
export function Field({ label, children, hint }: {
    label: string;
    children: ReactNode;
    hint?: string;
}) { return <label className="rx-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function PrivacyNote({ children }: {
    children: ReactNode;
}) { return <div className="rx-privacy"><Icon name="shield" size={19}/><span>{children}</span></div>; }
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) { useEffect(() => { function esc(e: KeyboardEvent) { if (e.key === 'Escape')
    onClose(); } document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]); return <div className="rx-overlay" onMouseDown={e => { if (e.target === e.currentTarget)
    onClose(); }}><div className="rx-sheet" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="rx-iconbtn" onClick={onClose}><Icon name="close"/></button></header>{children}</div></div>; }
