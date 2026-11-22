import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Field, Tag, MoneyRow, PrivacyNote, Empty } from '../components/UI';
import { firstWork, id, datetime, money, itemsOf } from '../lib/format';
import type { Request, Quote, Technician } from '../types/models';
export default function QuotesPage() {
    const { route, navigate, mutate, busy } = useApp();
    const { data: request, loading, error } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const work = firstWork(request);
    const { data: quotes, loading: ql, error: qe, refresh } = useRemote<any>(() => work ? api.quotes(work.workItemId) : Promise.resolve([]), [work?.workItemId]);
    const [selected, setSelected] = useState<Quote | null>(null), [check, setCheck] = useState<any>(null), [address, setAddress] = useState(''), [contact, setContact] = useState(''), [ready, setReady] = useState(false), [overlap, setOverlap] = useState(false);
    const [names, setNames] = useState<Record<string, string>>({});
    const rows = itemsOf<Quote>(quotes);
    useEffect(() => { let alive = true; const ids = [...new Set(rows.map(q => q.technicianId).filter(Boolean))]; Promise.allSettled(ids.map(x => api.get(`/public/technicians/${id(x)}`))).then(results => { if (!alive)
        return; const next: Record<string, string> = {}; results.forEach((result, i) => { if (result.status === 'fulfilled')
        next[ids[i]] = (result.value as Technician).displayName; }); setNames(next); }); return () => { alive = false; }; }, [quotes]);
    async function precheck(q: Quote) { setSelected(q); setCheck(null); setReady(false); setOverlap(false); await mutate(async () => { setCheck(await api.reservationCheck(q.quoteId)); }); }
    async function confirm() {
        if (!request || !work || !selected || !check || !ready)
            return;
        await mutate(async () => {
            const verifiedRequest = await api.get(`/requests/${id(request.requestId)}`) as Request;
            const updated = await api.put(`/requests/${id(request.requestId)}/visit-details`, { expectedRevision: verifiedRequest.revision, visitDetails: { address, contact }, confirmed: true }) as Request;
            let confirmedCheck = check;
            if (check.overlapConfirmationRequired) {
                if (!overlap)
                    throw Error('다른 기사 방문 중복 안내를 먼저 확인해 주세요.');
                confirmedCheck = await api.put(`/reservation-checks/${id(check.checkId)}/confirmation`, { confirmed: true }, true);
            }
            const payload: any = { quoteId: selected.quoteId, versions: selected.terms?.versions, visitDetailsRevision: updated.visitDetailsRevision };
            if (check.overlapConfirmationRequired)
                payload.overlapConfirmation = { checkId: confirmedCheck.checkId, confirmed: true };
            await api.post(`/work-items/${id(work.workItemId)}/reservations`, payload, true);
            navigate('bookings');
        }, '예약을 확정했어요.');
    }
    return <><PageHeader title="받은 견적 비교"/><div className="rx-body"><div className="rx-overline">MY QUOTES</div><h2 className="rx-page-title">견적을 꼼꼼하게 비교해요</h2><p className="rx-lead">금액·할인·방문 시간과 조건을 확인하고 선택해 주세요.</p>{loading || ql ? <Spinner /> : error || qe ? <ErrorState message={error || qe || ''} onRetry={() => void refresh()}/> : rows.length ? rows.map(q => <div className="rx-quote" key={q.quoteId}><div className="rx-quote-head"><div className="rx-expert-avatar"><Icon name="tool"/></div><div><strong>{names[q.technicianId] || '기사 정보 확인 중'}</strong><p>{q.terms?.fields?.join(' · ') || '작업 분야 확인'}</p></div><Tag tone={q.selectable ? 'sage' : 'rose'}>{q.selectable ? '선택 가능' : '선택 불가'}</Tag></div><h3>{q.terms?.scope || '작업 범위 확인'}</h3><div className="rx-moneybox"><MoneyRow label="확정 비용 (할인 전)" value={q.price?.beforeTotal}/><MoneyRow label="동선·조건 할인" value={-Number(q.price?.discountAmount || 0)}/><MoneyRow label="예상 확정 금액" value={q.price?.afterTotal} accent/></div>{q.terms?.cost?.lines?.map((line: any, i: number) => <div key={i} className="rx-moneyrow"><span>{line.description} {line.confirmed ? '' : '(조건부)'}</span><span>{line.confirmed ? money(line.afterAmount) : line.condition || '추후 합의'}</span></div>)}<p className="rx-quote-date"><Icon name="calendar" size={16}/> {datetime(q.terms?.startAt)} · {q.terms?.durationMinutes || 0}분</p>{(q.reasons?.length || 0) > 0 && <p className="rx-warn">{q.reasons?.join(' · ')}</p>}<Button disabled={!q.selectable || busy} onClick={() => void precheck(q)}>이 견적 예약 조건 확인 <Icon name="arrow" size={17}/></Button></div>) : <Empty icon="file" title="아직 받은 견적이 없어요" detail="수리 요청의 기사 상담이 수락되면 견적이 발행될 수 있어요." action={<Button onClick={() => navigate('experts')}>전문가 찾아보기</Button>}/>}
    {selected && check && <section className="rx-card rx-form"><h3>예약 확정 전 마지막 확인</h3><Tag tone={check.allowed ? 'sage' : 'rose'}>{check.allowed ? '사전 검사 가능' : '예약 조건 확인 필요'}</Tag>{check.checks?.map((c: any, i: number) => <p key={i}>{c.reason || c.code}</p>)}{check.allowed && <><Field label="방문 주소"><input placeholder="서울시 구·동을 포함한 상세 주소" value={address} onChange={e => setAddress(e.target.value)}/></Field><Field label="연락처"><input placeholder="방문 안내 연락처" value={contact} onChange={e => setContact(e.target.value)}/></Field>{check.overlapConfirmationRequired && <label className="rx-check"><input type="checkbox" checked={overlap} onChange={e => setOverlap(e.target.checked)}/> 다른 기사 방문과 겹치는 일정을 확인했어요.</label>}<label className="rx-check"><input type="checkbox" checked={ready} onChange={e => setReady(e.target.checked)}/> 주소·연락처·비용·일정 및 기사에게 공개될 범위를 확인했어요.</label><PrivacyNote>예약 확정 직전에 서버가 조건을 다시 검사하며, 사전 검사가 예약 가능성을 보장하지는 않아요.</PrivacyNote><Button disabled={busy || !ready || !address.trim() || !contact.trim() || (check.overlapConfirmationRequired && !overlap)} onClick={() => void confirm()}>이 조건으로 예약 확정</Button></>}</section>}</div></>;
}
