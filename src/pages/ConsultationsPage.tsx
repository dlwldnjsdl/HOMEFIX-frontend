import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Tag, Empty, Field, PrivacyNote, MediaImage, MoneyRow } from '../components/UI';
import { datetime, fieldLabel, itemsOf, id, localToSeoulIso, money, nextWeekdayDate, seoulDateTimeLocal, seoulTimePart, statusLabel } from '../lib/format';
import type { Consultation } from '../types/models';
export default function ConsultationsPage() {
    const { session, navigate } = useApp();
    const { data, loading, error, refresh } = useRemote<any>(() => api.consultations(), [session?.activeRole]);
    return <><PageHeader title="상담·견적 관리" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/>
        <div className="rx-body">
            <div className="rx-overline">CONSULTATIONS</div>
            <h2 className="rx-page-title">상담 요청 내역</h2>
            {loading ? <Spinner /> : error ? <ErrorState message={error}/> : itemsOf<Consultation>(data).length ? itemsOf<Consultation>(data).map(c => <button className="rx-request-card" key={c.consultationId} onClick={() => navigate('consultation', c.consultationId)}>
                <span className="rx-expert-avatar"><Icon name="chat"/></span>
                <span className="rx-request-copy">
                    <strong>상담 {c.consultationId.slice(0, 8)}…</strong>
                    <small>{statusLabel(c.status)} · {session?.activeRole === 'TECHNICIAN' ? '기사 수신 상담' : '내 요청 상담'} · 견적 {c.quotes?.length || 0}건</small>
                </span>
                <Icon name="chevron"/>
            </button>) : <Empty icon="chat" title="상담 내역이 없어요" detail="상담 요청을 보내거나 기사로 상담을 수락하면 내역이 표시돼요."/>}
        </div></>;
}
export function ConsultationDetailPage() {
    const { route, session, navigate, mutate, busy } = useApp();
    const { data: c, loading, error, refresh } = useRemote<Consultation>(() => api.get(`/consultations/${id(route.id!)}`) as Promise<Consultation>, [route.id]);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [reason, setReason] = useState('');
    const [scope, setScope] = useState('');
    const [start, setStart] = useState('');
    const [expires, setExpires] = useState('');
    const [minutes, setMinutes] = useState(60);
    const [labor, setLabor] = useState(50000);
    const [visit, setVisit] = useState(20000);
    const [partFee, setPartFee] = useState(30000);
    const [discount, setDiscount] = useState(10000);
    const [discountTarget, setDiscountTarget] = useState<'VISIT' | 'LABOR'>('VISIT');
    const [discountReason, setDiscountReason] = useState('목요일 14:00 기존 출장 사이 방문 시 출장비 1만 원 할인');
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    useEffect(() => {
        if (!c?.deliveryIds?.length) {
            setDeliveries([]);
            return;
        }
        let alive = true;
        void Promise.allSettled(c.deliveryIds.map((did: string) => api.delivery(did))).then(results => {
            if (!alive)
                return;
            setDeliveries(results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value));
        });
        return () => { alive = false; };
    }, [c?.consultationId, c?.deliveryIds?.join(',')]);

    useEffect(() => {
        const qc = c?.quoteContext;
        if (!qc)
            return;
        if (!scope && qc.facts?.workType) {
            setScope(`${qc.facts.part || ''} ${qc.facts.workType} ${qc.facts.quantity || 1}건`.trim());
        }
        if (qc.durationEstimate?.minutes) {
            setMinutes(Number(qc.durationEstimate.minutes));
        }
        const firstRange = qc.facts?.visitPreference?.ranges?.[0]?.startAt || qc.facts?.visitPreference?.fixedStartAt;
        if (!start && firstRange) {
            setStart(seoulDateTimeLocal(firstRange));
            const exp = new Date(new Date(firstRange).getTime() - 30 * 60000).toISOString();
            setExpires(seoulDateTimeLocal(exp));
        }
    }, [c?.consultationId, c?.quoteContext?.deliveryId]);

    async function change(action: 'ACCEPT' | 'REJECT' | 'CLOSE' | 'DESELECT') {
        if (!c)
            return;
        await mutate(async () => {
            await api.patch(`/consultations/${id(c.consultationId)}`, {
                expectedRevision: c.revision,
                action,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
            }, true);
            await refresh();
        }, '상담 상태를 변경했어요.');
    }

    async function issueQuote() {
        if (!c)
            return;
        setQuoteError(null);
        const qc = c.quoteContext;
        if (!qc?.deliveryId || !qc.commonVersion || !qc.itemVersion) {
            setQuoteError('확인된 견적 전제 버전이 없습니다. 사용자가 상담용 전달본을 확정해야 합니다.');
            return;
        }
        const maxDiscount = discountTarget === 'VISIT' ? visit : labor;
        if (discount > maxDiscount) {
            setQuoteError(`할인액은 ${discountTarget === 'VISIT' ? '출장비' : '공임'}(${money(maxDiscount)})을 넘을 수 없어요.`);
            return;
        }
        await mutate(async () => {
            try {
                const startAt = localToSeoulIso(start);
                const expiresAt = localToSeoulIso(expires);
                const visitAfter = discountTarget === 'VISIT' ? visit - discount : visit;
                const laborAfter = discountTarget === 'LABOR' ? labor - discount : labor;
                const lines: Array<Record<string, unknown>> = [
                    { category: 'LABOR', description: '공임', confirmed: true, beforeAmount: labor, afterAmount: laborAfter, condition: null },
                    { category: 'VISIT', description: '출장비', confirmed: true, beforeAmount: visit, afterAmount: visitAfter, condition: null },
                ];
                if (partFee > 0) {
                    lines.push({ category: 'PART', description: '부품비', confirmed: true, beforeAmount: partFee, afterAmount: partFee, condition: null });
                }
                await api.post(`/consultations/${id(c.consultationId)}/quotes`, {
                    contextDeliveryId: qc.deliveryId,
                    terms: {
                        versions: {
                            commonVersion: qc.commonVersion,
                            itemVersion: qc.itemVersion,
                            proposalVersion: null,
                        },
                        fields: qc.facts?.fields || [],
                        scope: scope.trim(),
                        quantity: Number(qc.facts?.quantity || 1),
                        durationMinutes: Number(minutes),
                        startAt,
                        expiresAt,
                        cost: {
                            minimumVisitFee: visitAfter,
                            minimumDiagnosticFee: 0,
                            lines,
                            discountCondition: discount > 0 ? discountReason.trim() : null,
                        },
                    },
                }, true);
                setQuoteOpen(false);
                await refresh();
            }
            catch (err: any) {
                setQuoteError(err?.message || '견적 발행 조건을 확인해 주세요.');
                throw err;
            }
        }, '견적을 발행했어요.');
    }

    if (loading)
        return <><PageHeader title="상담 상세"/><Spinner /></>;
    if (error || !c)
        return <><PageHeader title="상담 상세"/><ErrorState message={error || '상담 정보를 찾을 수 없어요.'}/></>;

    const beforeTotal = labor + visit + partFee;
    const afterTotal = beforeTotal - discount;
    const discountRate = beforeTotal > 0 ? ((discount / beforeTotal) * 100).toFixed(1) : '0.0';
    const latestDelivery = deliveries.at(-1);
    const quotes = c.quotes ?? [];
    const isRequestOwner = session?.activeRole === 'USER';

    return <><PageHeader title="상담 상세" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/>
        <div className="rx-body">
            <div className="rx-card">
                <Tag tone={c.status === 'ACCEPTED' ? 'sage' : 'rose'}>{statusLabel(c.status)}</Tag>
                <h2>기사 상담</h2>
                <p>작업 항목: {c.workItemId}</p>
                <p>추가 확인은 공개 연락수단으로 진행하며, 앱 내 채팅 대화는 저장하지 않아요.</p>
            </div>

            {latestDelivery?.content && <section className="rx-card">
                <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                    <h3>전달된 상담 자료</h3>
                    <Tag tone="sage">메타데이터 제거됨</Tag>
                </div>
                {latestDelivery.content.summary && <div className="rx-case-block">
                    <strong>사용자 확인 증상 요약</strong>
                    <p>{latestDelivery.content.summary.text}</p>
                    {latestDelivery.content.summary.unknowns?.length > 0 && <p className="rx-muted">미확인: {latestDelivery.content.summary.unknowns.join(', ')}</p>}
                </div>}
                {latestDelivery.content.quoteContext && <div className="rx-case-block">
                    <strong>작업·방문 조건</strong>
                    <p>지역: {latestDelivery.content.quoteContext.region?.district} {latestDelivery.content.quoteContext.region?.neighborhood}</p>
                    <p>분야: {latestDelivery.content.quoteContext.facts?.fields?.map(fieldLabel).join(' · ')} · 작업: {latestDelivery.content.quoteContext.facts?.workType || '미입력'} ({latestDelivery.content.quoteContext.facts?.quantity || 1}건)</p>
                    {latestDelivery.content.quoteContext.durationEstimate?.minutes && <p>기준표 추정 시간: {latestDelivery.content.quoteContext.durationEstimate.minutes}분</p>}
                    {latestDelivery.content.quoteContext.facts?.visitPreference?.ranges?.[0] && <p>방문 가능 구간: {datetime(latestDelivery.content.quoteContext.facts.visitPreference.ranges[0].startAt)} ~ {seoulTimePart(latestDelivery.content.quoteContext.facts.visitPreference.ranges[0].endAt)}</p>}
                </div>}
                <div>
                    <strong>전달된 사진 ({latestDelivery.content.photos?.length || 0}장)</strong>
                    {latestDelivery.content.photos?.length ? <div className="rx-photo-list" style={{ marginTop: 8 }}>
                        {latestDelivery.content.photos.map((p: any) => <div key={p.photoId} className="rx-photo-entry">
                            <MediaImage mediaId={p.media?.mediaId} className="rx-photo-tile" alt={p.observation || '상담 전달 사진'}/>
                            <small>{p.observation || '전달 사진'}</small>
                        </div>)}
                    </div> : <p className="rx-muted">선택된 전달 사진이 없어요.</p>}
                </div>
            </section>}

            <div className="rx-card rx-form">
                <h3>상담 관리</h3>
                <Field label="사유 (선택)"><input value={reason} onChange={e => setReason(e.target.value)}/></Field>
                {session?.activeRole === 'TECHNICIAN' && c.status === 'PENDING' && <div className="rx-duo-buttons">
                    <Button kind="secondary" disabled={busy} onClick={() => void change('ACCEPT')}>상담 수락</Button>
                    <Button kind="outline" disabled={busy} onClick={() => void change('REJECT')}>상담 거절</Button>
                </div>}
                {['PENDING', 'ACCEPTED'].includes(c.status) && <Button kind="ghost" disabled={busy} onClick={() => void change('CLOSE')}>상담 종료</Button>}
            </div>

            {session?.activeRole === 'TECHNICIAN' && c.status === 'ACCEPTED' && <div className="rx-card rx-form">
                <h3>기사 견적 발행</h3>
                <p>확인된 견적 전제와 기사 일정(작업·이동 시간)을 서버가 검사한 뒤 견적을 발행해요.</p>
                <Button kind="outline" onClick={() => { setQuoteOpen(x => !x); setQuoteError(null); }}>견적 작성 {quoteOpen ? '접기' : '열기'}</Button>
                {quoteOpen && <>
                    <div className="rx-chips">
                        <button type="button" onClick={() => {
                            const thursday = nextWeekdayDate(4);
                            setQuoteError(null);
                            setScope('연남동 싱크대 수전 1개 교체');
                            setStart(`${thursday}T14:45`);
                            setExpires(`${thursday}T14:15`);
                            setMinutes(60);
                            setLabor(50000);
                            setVisit(20000);
                            setPartFee(30000);
                            setDiscountTarget('VISIT');
                            setDiscount(10000);
                            setDiscountReason('목요일 14:45 시작 시 다음 서교동 방문 이동시간 충돌 검증');
                        }}>충돌 테스트 채우기 (목 14:45 · 60분)</button>
                        <button type="button" onClick={() => {
                            const thursday = nextWeekdayDate(4);
                            setQuoteError(null);
                            setScope('연남동 싱크대 수전 1개 교체');
                            setStart(`${thursday}T14:00`);
                            setExpires(`${thursday}T13:30`);
                            setMinutes(60);
                            setLabor(50000);
                            setVisit(20000);
                            setPartFee(30000);
                            setDiscountTarget('VISIT');
                            setDiscount(10000);
                            setDiscountReason('목요일 14:00 기존 출장 사이 방문 시 출장비 1만 원 할인');
                        }}>시나리오 2 할인 견적 채우기 (목 14:00 · 10만→9만)</button>
                    </div>
                    {quoteError && <ErrorState message={quoteError}/>}
                    <Field label="작업 범위"><textarea value={scope} onChange={e => setScope(e.target.value)} placeholder="예) 싱크대 수전 1개 교체"/></Field>
                    <div className="rx-duo-buttons">
                        <Field label="방문 시작 (15분 단위)"><input type="datetime-local" step={900} value={start} onChange={e => setStart(e.target.value)}/></Field>
                        <Field label="견적 유효 기한"><input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)}/></Field>
                    </div>
                    <Field label="작업 시간 (15분 단위, 분)"><input type="number" min={15} step={15} value={minutes} onChange={e => setMinutes(Number(e.target.value))}/></Field>
                    <div className="rx-duo-buttons">
                        <Field label="공임 (원)"><input type="number" min={0} step={1000} value={labor} onChange={e => setLabor(Number(e.target.value))}/></Field>
                        <Field label="출장비 (원)"><input type="number" min={0} step={1000} value={visit} onChange={e => setVisit(Number(e.target.value))}/></Field>
                    </div>
                    <Field label="부품비 (원)"><input type="number" min={0} step={1000} value={partFee} onChange={e => setPartFee(Number(e.target.value))}/></Field>
                    <div className="rx-duo-buttons">
                        <Field label="할인 적용 항목">
                            <select value={discountTarget} onChange={e => setDiscountTarget(e.target.value as 'VISIT' | 'LABOR')}>
                                <option value="VISIT">출장비 할인</option>
                                <option value="LABOR">공임 할인</option>
                            </select>
                        </Field>
                        <Field label="할인액 (원)"><input type="number" min={0} max={discountTarget === 'VISIT' ? visit : labor} step={1000} value={discount} onChange={e => setDiscount(Number(e.target.value))}/></Field>
                    </div>
                    {discount > 0 && <Field label="할인 조건 (견적 안내 문구)"><input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="예) 목요일 14:00 기존 출장 사이 방문 시 출장비 1만 원 할인"/></Field>}
                    <div className="rx-moneybox">
                        <MoneyRow label="할인 전 합계 (공임+출장비+부품비)" value={beforeTotal}/>
                        <MoneyRow label={`동선·조건 할인 (${discountRate}%)`} value={-discount}/>
                        <MoneyRow label="예상 확정 금액" value={afterTotal} accent/>
                    </div>
                    <PrivacyNote>서버가 기존 방문·이동시간 충돌(예: 14:45 시작 시 다음 방문 지연)과 할인 공식을 최종 검증해요.</PrivacyNote>
                    <Button disabled={busy || !scope.trim() || !start || !expires || minutes < 15 || minutes % 15 !== 0 || (discount > 0 && !discountReason.trim())} onClick={() => void issueQuote()}>견적 발행하기</Button>
                </>}
            </div>}

            {quotes.length > 0 && <section className="rx-card">
                <h3>발행된 견적 ({quotes.length}건)</h3>
                {quotes.map(q => <div key={q.quoteId} className="rx-case-block">
                    <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                        <strong>{q.terms?.scope}</strong>
                        <Tag tone={q.selectable ? 'sage' : 'rose'}>{isRequestOwner && q.selectable ? '선택 가능' : statusLabel(q.status)}</Tag>
                    </div>
                    <p>{datetime(q.terms?.startAt)} ~ {seoulTimePart(q.endAt)} ({q.terms?.durationMinutes}분)</p>
                    <p>할인 전 {money(q.price?.beforeTotal)} → 확정 <strong>{money(q.price?.afterTotal)}</strong>{q.price && q.price.discountAmount > 0 ? ` (-${money(q.price.discountAmount)}, ${q.price.discountRate}%)` : ''}</p>
                    {q.terms?.cost?.discountCondition && <p className="rx-muted">할인 조건: {q.terms.cost.discountCondition}</p>}
                    {q.reasons?.length ? <p className="rx-warn">{q.reasons.join(' · ')}</p> : null}
                </div>)}
                {isRequestOwner && <Button onClick={() => navigate('quotes', `work-items/${c.workItemId}`)}>
                    받은 견적 비교하기 <Icon name="arrow" size={17}/>
                </Button>}
            </section>}
        </div></>;
}
