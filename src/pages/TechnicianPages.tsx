import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, ScreenIntro, Icon, Button, Field, Empty, Spinner, ErrorState, Tag, PrivacyNote } from '../components/UI';
import { fieldCodes, fieldLabel, itemsOf, datetime, today, nextWeekdayDate, seoulTimePart, statusLabel } from '../lib/format';
import type { Consultation } from '../types/models';
const isTech = (role?: string) => role === 'TECHNICIAN';
export default function TechnicianHome() {
    const { session, navigate } = useApp();
    const { data: me, loading, error } = useRemote<any>(() => api.technicianMe(), [session?.technicianId]);
    const { data: consultations } = useRemote<any>(() => api.consultations(), [session?.activeRole]);
    if (!isTech(session?.activeRole))
        return <AccessGate />;
    return <><PageHeader title="기사 업무"/><div className="rx-body rx-theme-sage"><ScreenIntro tag="EXPERT WORKSPACE" tone="sage" title="우리 집을 고치는 전문가" subtitle="상담과 일정, 사례를 한곳에서 관리해요." illustration="illustration-expert.svg"/>{loading ? <Spinner /> : error ? <ErrorState message={error}/> : <div className="rx-card"><Tag tone="sage">기사 모드</Tag><h3>{me?.profile?.displayName || '전문가 프로필'}</h3><p>새 상담 {itemsOf<Consultation>(consultations).filter(x => x.status === 'PENDING').length}건</p></div>}<div className="rx-quick-grid">{[{ icon: 'chat', title: '상담·견적', page: 'consultations' as const, description: '상담 수락과 견적 발행' }, { icon: 'calendar', title: '방문 일정', page: 'tech-schedule' as const, description: '가능 시간·외부 일정' }, { icon: 'map', title: '동선 탐색', page: 'tech-routes' as const, description: '인근 방문·추가 이동' }, { icon: 'photo', title: '시공 사례', page: 'tech-cases' as const, description: '사진·수리 사례 관리' }, { icon: 'user', title: '기사 프로필', page: 'tech-profile' as const, description: '활동 분야·지역·연락처' }].map(item => <button className="rx-quick-card" key={item.page} onClick={() => navigate(item.page)}><Icon name={item.icon} size={26}/><strong>{item.title}</strong><small>{item.description}</small><Icon name="arrow" size={17}/></button>)}</div></div></>;
}
export function AccessGate() {
    const { navigate } = useApp();
    return <><PageHeader title="기사 전용 화면"/><div className="rx-body"><Empty icon="shield" title="기사 권한이 필요해요" detail="이 화면은 서버에서 TECHNICIAN 역할이 허용된 계정으로만 이용할 수 있어요. 일반 계정에 기사 권한을 자동 부여하지 않아요." action={<Button onClick={() => navigate('profile')}>계정·역할 확인</Button>}/></div></>;
}
export function TechProfilePage() {
    const { session, mutate, busy } = useApp();
    const { data: me, loading, error, refresh } = useRemote<any>(() => api.technicianMe(), [session?.technicianId]);
    const { data: service } = useRemote<any>(() => api.serviceInfo(), []);
    const [name, setName] = useState(''), [fields, setFields] = useState<string[]>([]), [regions, setRegions] = useState<string[]>([]), [contact, setContact] = useState(''), [publicContact, setPublicContact] = useState(false);
    useEffect(() => {
        if (!me)
            return;
        setName(me.profile?.displayName || '');
        setFields(me.profile?.fields || []);
        setRegions(me.profile?.regionIds || []);
        setContact(me.profile?.contacts?.[0]?.contact?.value || '');
        setPublicContact(me.profile?.contacts?.[0]?.isPublic || false);
    }, [me?.profileRevision]);
    if (!isTech(session?.activeRole))
        return <AccessGate />;
    async function save() {
        await mutate(async () => {
            await api.put('/technicians/me/profile', { expectedRevision: me.profileRevision, profile: { displayName: name, fields, regionIds: regions, contacts: contact ? [{ contact: { label: '업무 전화', value: contact }, isPublic: publicContact }] : [], representativeMediaIds: me.profile?.representativeMediaIds || [] } });
            await refresh();
        }, '기사 프로필을 저장했어요.');
    }
    return <><PageHeader title="기사 프로필"/>{loading ? <Spinner /> : error ? <ErrorState message={error}/> : <div className="rx-body rx-form"><div className="rx-card"><h3>공개할 전문가 정보</h3><Field label="업체·기사 표시명"><input value={name} onChange={e => setName(e.target.value)}/></Field><p>전문 분야</p><div className="rx-chips">{fieldCodes.map(code => <label key={code} className="rx-check"><input type="checkbox" checked={fields.includes(code)} onChange={e => setFields(s => e.target.checked ? [...s, code] : s.filter(x => x !== code))}/>{fieldLabel(code)}</label>)}</div><Field label="활동 지역 (복수 선택)"><select value="" onChange={e => { const value = e.target.value; if (value && !regions.includes(value)) setRegions(x => [...x, value]); }}><option value="">서울 지역 선택</option>{service?.regions?.map((r: any) => <option key={r.regionId || r.locationId} value={r.regionId || r.locationId}>{r.district} {r.neighborhood}</option>)}</select></Field><div className="rx-chips">{regions.map(region => <button key={region} onClick={() => setRegions(x => x.filter(r => r !== region))}>{region} ×</button>)}</div><Field label="업무 연락처"><input value={contact} onChange={e => setContact(e.target.value)} placeholder="전화번호 또는 검증된 연락 경로"/></Field><label className="rx-check"><input type="checkbox" checked={publicContact} onChange={e => setPublicContact(e.target.checked)}/> 연락처 공개</label><Button disabled={busy || !name || !fields.length || !regions.length} onClick={() => void save()}>프로필 저장하기</Button></div><PrivacyNote>공개 설정한 연락처만 비로그인 기사 목록에 표시돼요.</PrivacyNote></div>}</>;
}
export function TechSchedulePage() {
    const { session, mutate, busy } = useApp();
    const [date, setDate] = useState(() => nextWeekdayDate(4));
    const { data: schedule, loading, error, refresh } = useRemote<any>(() => api.get('/technicians/me/schedule', { from: date, to: date }), [date, session?.activeRole]);
    const [from, setFrom] = useState('09:00'), [to, setTo] = useState('17:00');
    if (!isTech(session?.activeRole))
        return <AccessGate />;
    async function save() {
        await mutate(async () => {
            await api.put('/technicians/me/schedule', { expectedRevision: schedule.revision, from: date, to: date, availability: [...schedule.availability || [], { startAt: `${date}T${from}:00+09:00`, endAt: `${date}T${to}:00+09:00` }], externalVisits: schedule.externalVisits || [] });
            await refresh();
        }, '가능 시간을 등록했어요.');
    }
    return <><PageHeader title="기사 방문 일정"/><div className="rx-body rx-theme-lavender">
        <div className="rx-card rx-form">
            <Field label="조회 날짜"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
            <div className="rx-chips">
                <button type="button" onClick={() => setDate(today())}>오늘</button>
                <button type="button" onClick={() => setDate(nextWeekdayDate(4))}>다음 목요일</button>
                <button type="button" onClick={() => setDate(nextWeekdayDate(6))}>다음 토요일</button>
            </div>
        </div>
        {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={() => void refresh()}/> : <>
            <section className="rx-card">
                <h3>가능 시간</h3>
                {schedule?.availability?.length ? schedule.availability.map((x: any, i: number) => <div key={i} className="rx-timeline-item"><Icon name="clock" size={18}/>{datetime(x.startAt)} — {seoulTimePart(x.endAt)}</div>) : <p className="rx-muted">등록된 가능 시간이 없어요.</p>}
                <h3>기존 외부 방문</h3>
                {schedule?.externalVisits?.length ? schedule.externalVisits.map((x: any, i: number) => <div key={x.externalVisitId || i} className="rx-timeline-item"><Icon name="pin" size={16}/><span>{datetime(x.range?.startAt)} — {seoulTimePart(x.range?.endAt)} · {x.description || '외부 일정'}</span></div>) : <p className="rx-muted">등록된 외부 일정이 없어요.</p>}
                <h3>확정 예약</h3>
                {schedule?.reservations?.length ? schedule.reservations.map((x: any) => <div key={x.reservationId} className="rx-timeline-item"><Icon name="calendar" size={16}/><span>{datetime(x.agreement?.terms?.startAt)} — {seoulTimePart(x.agreement?.terms?.expectedEndAt)} · {x.agreement?.terms?.scope || '예약'}</span></div>) : <p className="rx-muted">확정 예약이 없어요.</p>}
            </section>
            <section className="rx-card rx-form">
                <h3>가능 시간 추가</h3>
                <div className="rx-duo-buttons"><Field label="시작"><input type="time" step={900} value={from} onChange={e => setFrom(e.target.value)}/></Field><Field label="종료"><input type="time" step={900} value={to} onChange={e => setTo(e.target.value)}/></Field></div>
                <PrivacyNote>방문 가능 시간은 15분 단위로 저장돼요. 예약·이동 충돌은 서버가 다시 검사해요.</PrivacyNote>
                <Button disabled={busy || !schedule || from >= to} onClick={() => void save()}>가능 시간 저장</Button>
            </section>
        </>}
    </div></>;
}
export function TechRoutesPage() {
    const { session, mutate, busy } = useApp();
    const [date, setDate] = useState(() => nextWeekdayDate(4));
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
    const { data, loading, error, refresh } = useRemote<any>(() => api.routeCandidates(date), [date, session?.activeRole]);
    if (!isTech(session?.activeRole))
        return <AccessGate />;
    const items = itemsOf<any>(data);
    async function expressInterest(candidateId: string) {
        await mutate(async () => {
            await api.expressInterest(candidateId);
            setSubmitted(prev => ({ ...prev, [candidateId]: true }));
        }, '상담 참여 의사를 표시했어요. 사용자가 상담 상대로 선택하면 자료를 열람할 수 있어요.');
    }
    return <><PageHeader title="기사 동선 추천" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/>
        <div className="rx-body rx-theme-sage">
            <ScreenIntro tag="ROUTE EXPLORATION" tone="sage" title="내 일정과 가까운 수리" subtitle="실제 도로 시간이 아닌 서울 동별 고정 모의 이동시간 기준" illustration="illustration-expert.svg"/>
            <div className="rx-card rx-form">
                <Field label="동선 조회 날짜"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
                <div className="rx-chips">
                    <button type="button" onClick={() => setDate(nextWeekdayDate(4))}>다음 목요일 ({nextWeekdayDate(4)})</button>
                    <button type="button" onClick={() => setDate(today())}>오늘 ({today()})</button>
                </div>
            </div>
            {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={() => void refresh()}/> : items.length ? items.map((x, index) => <article className="rx-card" key={x.candidateId}>
                <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                    <div className="rx-inline">
                        <Tag tone="sage">추천 {index + 1}위</Tag>
                        <Tag tone={x.timeFit === 'MATCHED' ? 'sage' : 'rose'}>{statusLabel(x.timeFit)}</Tag>
                    </div>
                    {x.route && <Tag tone="lavender">추가 이동 +{x.route.additionalMinutes}분</Tag>}
                </div>
                <h3>{x.region?.district} {x.region?.neighborhood} · {x.fields?.map(fieldLabel).join(' · ')}</h3>
                <p>추정 작업 시간: {x.durationEstimate?.minutes ? `${x.durationEstimate.minutes}분 (기준표 추정)` : '기사 확인 필요'}</p>
                {x.route ? <div className="rx-route-math">
                    <strong>삽입 가능 구간</strong>: {datetime(x.route.insertionRange?.startAt)} ~ {seoulTimePart(x.route.insertionRange?.endAt)}<br/>
                    <strong>추가 이동 계산</strong>: {x.route.beforeToRequestMinutes}분 + {x.route.requestToAfterMinutes}분 − {x.route.beforeToAfterMinutes}분 = <strong>{x.route.additionalMinutes}분</strong>
                </div> : <p className="rx-muted">{x.reason || '추가 이동 계산 미산정'}</p>}
                <Button disabled={busy || !!submitted[x.candidateId]} onClick={() => void expressInterest(x.candidateId)}>
                    {submitted[x.candidateId] ? '참여 의사 표시 완료' : '상담 참여 의사 표시'}
                </Button>
            </article>) : <Empty icon="map" title="현재 동선 추천 후보가 없어요" detail="선택한 날짜에 동선 탐색이 켜진 적합 작업이 있으면 추가 이동 시간이 작은 순서로 표시돼요."/>}
            <PrivacyNote>고객 이름·사진·상세 요약·주소는 동선 추천 단계에 노출되지 않아요. 참여 의사는 예약 확약이 아니며 사용자 선택 후 상담이 시작돼요.</PrivacyNote>
        </div></>;
}
export function TechCasesPage() {
    const { session, mutate, busy } = useApp();
    const { data: me, loading, error, refresh } = useRemote<any>(() => api.technicianMe(), [session?.technicianId]);
    const [title, setTitle] = useState(''), [symptom, setSymptom] = useState(''), [work, setWork] = useState(''), [sourceTitle, setSourceTitle] = useState(''), [sourceRef, setSourceRef] = useState(''), [field, setField] = useState('PLUMBING');
    if (!isTech(session?.activeRole))
        return <AccessGate />;
    async function save() {
        await mutate(async () => {
            await api.post('/technicians/me/cases', { case: { title, fields: [field], initialSymptom: symptom, confirmedCause: null, workDescription: work, parts: [], beforeMediaIds: [], afterMediaIds: [], dataType: 'REPRODUCED', source: { title: sourceTitle, reference: sourceRef, version: '1', verifiedAt: today(), usageBasis: '사용권한 확인 필요' } } }, true);
            await refresh();
        }, '시공 사례를 저장했어요.');
    }
    return <><PageHeader title="시공 사례 관리"/><div className="rx-body"><h2 className="rx-page-title">기사 포트폴리오</h2>{loading ? <Spinner /> : error ? <ErrorState message={error}/> : <>{me?.portfolio?.cases?.length ? me.portfolio.cases.map((x: any) => <div className="rx-card" key={x.caseId}><h3>{x.content?.title}</h3><p>{x.content?.workDescription}</p><Tag tone="sage">{statusLabel(x.content?.dataType)}</Tag></div>) : <Empty icon="photo" title="등록한 시공 사례가 없어요" detail="실제 작업이 아닌 시연 자료는 모의·재현으로 표시하고 출처를 남겨 주세요."/>}<div className="rx-card rx-form"><h3>시연용 사례 등록</h3><Field label="사례 제목"><input value={title} onChange={e => setTitle(e.target.value)}/></Field><Field label="분야"><select value={field} onChange={e => setField(e.target.value)}>{fieldCodes.map(c => <option key={c} value={c}>{fieldLabel(c)}</option>)}</select></Field><Field label="처음 증상"><textarea value={symptom} onChange={e => setSymptom(e.target.value)}/></Field><Field label="작업 설명"><textarea value={work} onChange={e => setWork(e.target.value)}/></Field><Field label="자료 출처명"><input value={sourceTitle} onChange={e => setSourceTitle(e.target.value)}/></Field><Field label="출처 식별값"><input value={sourceRef} onChange={e => setSourceRef(e.target.value)}/></Field><PrivacyNote>자료 사용 가능 근거가 확인되지 않으면 서버가 등록을 거절할 수 있어요. 허위 사례를 실제 시공처럼 노출하지 않아요.</PrivacyNote><Button disabled={busy || !title || !symptom || !work || !sourceTitle || !sourceRef} onClick={() => void save()}>사례 등록</Button></div></>}</div></>;
}
