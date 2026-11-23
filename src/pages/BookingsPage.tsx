import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, ScreenIntro, Spinner, ErrorState, Empty, Icon, Button, Tag, Field, PrivacyNote, MarkdownView, AnnotatedPhoto, type RegionBox } from '../components/UI';
import { itemsOf, day, datetime, id, seoulTimePart, statusLabel } from '../lib/format';
import type { Reservation } from '../types/models';
function start(r: Reservation) { return r.agreement?.terms?.startAt || r.agreement?.startAt || r.startAt; }
export default function BookingsPage() {
    const { navigate, session } = useApp();
    const { data, loading, error, refresh } = useRemote<any>(() => session ? api.reservations() : Promise.resolve([]), [session?.loginId, session?.activeRole]);
    const [dayFilter, setDayFilter] = useState('');
    const rows = itemsOf<Reservation>(data);
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, label: d.toLocaleDateString('ko-KR', { weekday: 'short' }), number: d.getDate() };
    });
    const shown = rows.filter(r => !dayFilter || String(start(r) || '').slice(0, 10) === dayFilter);
    return <><PageHeader title="방문 일정" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/>
        <div className="rx-body rx-theme-lavender">
            <ScreenIntro tag="MY APPOINTMENTS" tone="lavender" title="우리 집 방문 일정" subtitle="상담부터 예약, 인계서와 방문 준비까지 확인해요." illustration="illustration-calendar.svg"/>
            <div className="rx-calendar">
                <div className="rx-calendar-head"><Icon name="calendar"/><strong>다가오는 7일</strong><button className="rx-link" onClick={() => setDayFilter('')}>전체 보기</button></div>
                <div className="rx-week">{dates.map(x => <button className={dayFilter === x.date ? 'selected' : ''} key={x.date} onClick={() => setDayFilter(dayFilter === x.date ? '' : x.date)}><small>{x.label}</small><strong>{x.number}</strong><i className={rows.some(r => String(start(r) || '').slice(0, 10) === x.date) ? 'has-visit' : ''}/></button>)}</div>
            </div>
            <div className="rx-stats">
                <div><Icon name="clock"/><span>예정된 방문</span><strong>{rows.filter(r => ['RESERVED', 'CONFIRMED'].includes(r.status)).length}건</strong></div>
                <div><Icon name="file"/><span>전체 예약 기록</span><strong>{rows.length}건</strong></div>
            </div>
            <div className="rx-section-title"><div><h2>예약 내역</h2><p>날짜와 진행 단계를 확인하세요.</p></div></div>
            {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={() => void refresh()}/> : shown.length ? shown.map(r => <button key={r.reservationId} className="rx-appointment" onClick={() => navigate('booking', r.reservationId)}>
                <div className="rx-appointment-top"><span>{day(start(r))}</span><Tag tone="lavender">{statusLabel(r.status)}</Tag></div>
                <strong>{r.agreement?.terms?.scope || '우리 집 수리 방문'}</strong>
                <p><Icon name="clock" size={16}/> {datetime(start(r))} ~ {seoulTimePart(r.agreement?.terms?.expectedEndAt)}</p>
                <div className="rx-steps-graphic"><i className="done"/><span /><span /><span /></div>
                <small>예약 확정　　방문 예정　　작업 진행　　완료</small>
                <Icon name="chevron" size={19}/>
            </button>) : <Empty icon="calendar" title="아직 방문 일정이 없어요" detail="수리 요청을 작성하고 기사 견적을 받으면 여기서 관리할 수 있어요." action={<Button onClick={() => navigate('experts')}>기사 찾기</Button>}/>}
            <PrivacyNote>방문 예정 시각은 실제 서버의 확인된 예약 정보만 표시해요.</PrivacyNote>
        </div></>;
}
export function BookingDetailPage() {
    const { route, mutate, busy, session } = useApp();
    const { data: r, loading, error, refresh } = useRemote<Reservation>(() => api.get(`/reservations/${id(route.id!)}`) as Promise<Reservation>, [route.id]);
    const [handovers, setHandovers] = useState<any[]>([]);
    const [reason, setReason] = useState('');
    const [revoke, setRevoke] = useState(false);
    const [inspectionText, setInspectionText] = useState('');
    const [equipmentText, setEquipmentText] = useState('');
    const [partsText, setPartsText] = useState('');
    const [prepNote, setPrepNote] = useState('');

    useEffect(() => {
        if (!r?.handoverDeliveryIds?.length) {
            setHandovers([]);
            return;
        }
        let alive = true;
        void Promise.allSettled(r.handoverDeliveryIds.map((did: string) => api.delivery(did))).then(results => {
            if (!alive)
                return;
            setHandovers(results.filter((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled').map(x => x.value));
        });
        return () => { alive = false; };
    }, [r?.reservationId, r?.handoverDeliveryIds?.join(',')]);

    useEffect(() => {
        const prep = r?.preparation;
        if (!prep)
            return;
        setInspectionText((prep.inspectionItems || []).join('\n'));
        setEquipmentText((prep.equipment || []).join(', '));
        setPartsText((prep.parts || []).join(', '));
        setPrepNote(prep.note || '');
    }, [r?.reservationId, JSON.stringify(r?.preparation)]);

    async function cancel() {
        if (!r || !window.confirm('실제 예약을 취소할까요?'))
            return;
        await mutate(async () => {
            await api.post(`/reservations/${id(r.reservationId)}/cancellation`, { agreementVersion: r.agreement?.agreementVersion, reason }, true);
            await refresh();
        }, '예약 취소를 접수했어요.');
    }

    async function earlyConsent() {
        if (!r)
            return;
        await mutate(async () => {
            await api.put(`/reservations/${id(r.reservationId)}/early-start-consent`, { agreementVersion: r.agreement?.agreementVersion, expectedConsentRevision: r.earlyStartConsent?.revision || null, action: 'REVOKE' });
            setRevoke(true);
            await refresh();
        }, '조기 시작 동의를 철회했어요.');
    }

    async function savePreparation() {
        if (!r)
            return;
        const splitList = (raw: string) => raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        await mutate(async () => {
            await api.preparationNotes(r.reservationId, {
                equipment: splitList(equipmentText),
                parts: splitList(partsText),
                inspectionItems: splitList(inspectionText),
                note: prepNote.trim() || null,
            });
            await refresh();
        }, '방문 준비사항을 저장했어요.');
    }

    const latestHandover = handovers.at(-1);
    const activeTech = session?.activeRole === 'TECHNICIAN' && r && ['CONFIRMED', 'IN_PROGRESS', 'STOP_REQUESTED'].includes(r.status);

    return <><PageHeader title="예약 상세" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/>
        {loading ? <Spinner /> : error || !r ? <ErrorState message={error || '예약 정보를 확인하지 못했어요.'}/> : <div className="rx-body rx-theme-lavender">
            <div className="rx-card">
                <Tag tone="lavender">{statusLabel(r.status)}</Tag>
                <h2>{r.agreement?.terms?.scope || '수리 예약'}</h2>
                <p><Icon name="calendar" size={17}/> {datetime(start(r))} ~ {seoulTimePart(r.agreement?.terms?.expectedEndAt)}</p>
                {r.agreement?.terms?.visitDetails?.address && <p><Icon name="pin" size={15}/> {r.agreement.terms.visitDetails.address} · {r.agreement.terms.visitDetails.contact}</p>}
            </div>

            {latestHandover?.content?.report && <section className="rx-card">
                <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                    <h3>사전 인계 보고서</h3>
                    <Tag tone="sage">사용자 확인 완료</Tag>
                </div>
                <div className="rx-document">
                    <MarkdownView markdown={latestHandover.content.report.content?.markdown}/>
                </div>
                {latestHandover.content.report.photos?.length > 0 && <div className="rx-compare-grid">
                    {latestHandover.content.report.photos.map((p: any) => <AnnotatedPhoto
                        key={p.photoId}
                        mediaId={p.media?.mediaId}
                        regions={(p.regions || []) as RegionBox[]}
                        caption={`촬영일: ${p.capturedOn ? day(p.capturedOn) : '미확인'} · ${p.observation || ''}`}
                    />)}
                </div>}
            </section>}

            {r.preparation && <div className="rx-card">
                <h3>기사 방문 준비사항</h3>
                {r.preparation.inspectionItems?.length > 0 && <div><strong>현장 점검 항목</strong>{r.preparation.inspectionItems.map((x: string, i: number) => <p key={i}>• {x}</p>)}</div>}
                {r.preparation.equipment?.length > 0 && <p>준비 장비: {r.preparation.equipment.join(', ')}</p>}
                {r.preparation.parts?.length > 0 && <p>준비 부품: {r.preparation.parts.join(', ')}</p>}
                {r.preparation.note && <p>메모: {r.preparation.note}</p>}
            </div>}

            {activeTech && <section className="rx-card rx-form">
                <h3>방문 준비사항 등록·수정 (기사)</h3>
                <div className="rx-chips">
                    <button type="button" onClick={() => {
                        setInspectionText('창틀 주변과 벽지 물자국 경계를 함께 점검');
                        setEquipmentText('수분측정기');
                        setPartsText('');
                        setPrepNote('창틀 주변과 벽지 물자국 경계를 함께 점검');
                    }}>시나리오 3 준비사항 채우기</button>
                </div>
                <Field label="현장 점검 항목 (줄바꿈 또는 쉼표 구분)">
                    <textarea rows={2} value={inspectionText} onChange={e => setInspectionText(e.target.value)} placeholder="예) 창틀 주변과 벽지 물자국 경계를 함께 점검"/>
                </Field>
                <div className="rx-duo-buttons">
                    <Field label="준비 장비"><input value={equipmentText} onChange={e => setEquipmentText(e.target.value)} placeholder="예) 수분측정기"/></Field>
                    <Field label="준비 부품"><input value={partsText} onChange={e => setPartsText(e.target.value)} placeholder="예) 실리콘"/></Field>
                </div>
                <Field label="방문 전 메모"><input value={prepNote} onChange={e => setPrepNote(e.target.value)} placeholder="예) 창틀 주변과 벽지 물자국 경계를 함께 점검"/></Field>
                <Button disabled={busy || (!inspectionText.trim() && !equipmentText.trim() && !partsText.trim() && !prepNote.trim())} onClick={() => void savePreparation()}>방문 준비사항 저장</Button>
            </section>}

            {r.changes?.length > 0 && <section className="rx-card">
                <h3>일정·작업 변경안</h3>
                {r.changes.map((c: any) => <div key={c.changeId} className="rx-mini-card"><p>{c.type} · {statusLabel(c.status)}</p><button className="rx-link" onClick={() => void mutate(async () => { await api.patch(`/reservation-changes/${id(c.changeId)}`, { expectedRevision: c.revision, action: 'REJECT' }, true); await refresh(); }, '변경안을 거절했어요.')}>변경안 거절</button></div>)}
            </section>}

            {r.status === 'CONFIRMED' && <div className="rx-card rx-form">
                <h3>예약 관리</h3>
                <Field label="취소 사유"><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="취소할 경우 사유를 입력하세요"/></Field>
                <Button kind="outline" disabled={busy} onClick={() => void cancel()}>시작 전 예약 취소</Button>
                {session?.activeRole === 'USER' && r.earlyStartConsent?.active && !revoke && <Button kind="ghost" disabled={busy} onClick={() => void earlyConsent()}>조기 시작 동의 철회</Button>}
            </div>}
            <PrivacyNote>이미 시작된 작업은 일반 예약 취소가 제한돼요. 진행 중 변경은 별도 합의가 필요해요.</PrivacyNote>
        </div>}
    </>;
}
