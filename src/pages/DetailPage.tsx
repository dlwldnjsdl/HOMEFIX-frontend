import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, MediaImage, Tag, Button, Field, Modal, PrivacyNote } from '../components/UI';
import { allPhotos, day, datetime, firstWork, statusLabel, id, fieldCodes, fieldLabel, assertPhotos, standardWorkTypes, nextWeekdayDate, seoulDatePart, seoulTimePart, seoulIso } from '../lib/format';
import type { Request, WorkItem } from '../types/models';
type EditModal = 'symptom' | 'record' | 'item' | 'photos' | 'close' | 'facts' | 'confirm' | null;
export default function DetailPage() {
    const { route, navigate, mutate, busy, notice } = useApp();
    const { data: request, loading, error, refresh } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const [selected, setSelected] = useState('');
    const [edit, setEdit] = useState<EditModal>(null);
    const [value, setValue] = useState(''), [itemWorkType, setItemWorkType] = useState(''), [itemField, setItemField] = useState('PLUMBING'), [date, setDate] = useState(''), [photoFiles, setPhotoFiles] = useState<File[]>([]);
    // Work item facts & non-AI confirmation form state
    const [district, setDistrict] = useState('마포구');
    const [neighborhood, setNeighborhood] = useState('연남동');
    const [factPart, setFactPart] = useState('');
    const [factWorkType, setFactWorkType] = useState('');
    const [factQty, setFactQty] = useState(1);
    const [factFields, setFactFields] = useState<string[]>(['PLUMBING']);
    const [visitMode, setVisitMode] = useState<'FLEXIBLE' | 'FIXED'>('FLEXIBLE');
    const [visitDate, setVisitDate] = useState(() => nextWeekdayDate(4));
    const [visitStart, setVisitStart] = useState('14:00');
    const [visitEnd, setVisitEnd] = useState('17:00');
    const [confirmText, setConfirmText] = useState('');
    const [confirmFields, setConfirmFields] = useState<string[]>(['PLUMBING']);
    const [routeConfirm, setRouteConfirm] = useState(false);

    const work: WorkItem | undefined = request?.workItems?.find(w => w.workItemId === selected) || firstWork(request);

    function openFactsModal() {
        if (!request || !work)
            return;
        setDistrict(request.region?.district || '마포구');
        setNeighborhood(request.region?.neighborhood || '연남동');
        setFactPart(String(work.facts?.part || request.context?.locationDescription || ''));
        setFactWorkType(String(work.facts?.workType || ''));
        setFactQty(Number(work.facts?.quantity || 1));
        setFactFields(work.facts?.fields?.length ? [...work.facts.fields] : ['PLUMBING']);
        const pref = work.facts?.visitPreference as any;
        if (pref?.mode === 'FIXED' && pref.fixedStartAt) {
            setVisitMode('FIXED');
            setVisitDate(seoulDatePart(pref.fixedStartAt));
            setVisitStart(seoulTimePart(pref.fixedStartAt));
        }
        else if (pref?.mode === 'FLEXIBLE' && pref.ranges?.[0]) {
            setVisitMode('FLEXIBLE');
            setVisitDate(seoulDatePart(pref.ranges[0].startAt));
            setVisitStart(seoulTimePart(pref.ranges[0].startAt));
            setVisitEnd(seoulTimePart(pref.ranges[0].endAt));
        }
        else {
            setVisitMode('FLEXIBLE');
            setVisitDate(nextWeekdayDate(4));
            setVisitStart('14:00');
            setVisitEnd('17:00');
        }
        setEdit('facts');
    }

    function openConfirmModal() {
        if (!request || !work)
            return;
        setConfirmText(work.summary?.text || `${request.symptom} (원인은 현장 점검 필요)`);
        setConfirmFields(work.facts?.fields?.length ? [...work.facts.fields] : ['PLUMBING']);
        setEdit('confirm');
    }

    async function toggleRouteExploration() {
        if (!request || !work)
            return;
        const nextEnabled = !work.routeExplorationEnabled;
        if (nextEnabled && !routeConfirm)
            return notice('최소 작업 정보 공개 안내를 먼저 확인해 주세요.', 'error');
        await mutate(async () => {
            const latestReq = await api.request(request.requestId) as Request;
            const latestWork = latestReq.workItems?.find(w => w.workItemId === work.workItemId) || firstWork(latestReq);
            if (!latestWork?.workItemId)
                throw Error('작업 항목을 찾을 수 없어요.');
            await api.routeExploration(latestWork.workItemId, {
                expectedRevision: latestWork.revision,
                enabled: nextEnabled,
                confirmed: true,
            });
            setRouteConfirm(false);
            await refresh();
        }, nextEnabled ? '동선 제안 탐색을 켰어요.' : '동선 제안 탐색을 중단했어요.');
    }

    async function save() {
        if (!request || !edit)
            return;
        await mutate(async () => {
            const latestReq = await api.request(request.requestId) as Request;
            const latestWorkInitial = work ? (latestReq.workItems?.find(w => w.workItemId === work.workItemId) || firstWork(latestReq)) : firstWork(latestReq);
            if (edit === 'symptom') {
                await api.editRequest(latestReq.requestId, latestReq.revision, { symptom: value });
            }
            if (edit === 'record') {
                await api.post(`/requests/${id(latestReq.requestId)}/records`, {
                    record: { occurredOn: date || null, description: value, photoIds: [], workItemIds: latestWorkInitial ? [latestWorkInitial.workItemId] : [] },
                }, true);
            }
            if (edit === 'item') {
                await api.post(`/requests/${id(latestReq.requestId)}/work-items`, {
                    expectedRevision: latestReq.revision,
                    facts: { part: value, workType: itemWorkType, quantity: 1, fields: [itemField], otherField: null, product: { productType: null, manufacturer: null, modelName: null }, visitPreference: null },
                }, true);
            }
            if (edit === 'photos') {
                assertPhotos(photoFiles);
                const form = new FormData();
                for (const f of photoFiles)
                    form.append('files', f);
                form.append('metadata', JSON.stringify(photoFiles.map(() => ({ capturedOn: date || null, dateConfirmed: !!date, description: null, workItemIds: latestWorkInitial ? [latestWorkInitial.workItemId] : [] }))));
                await api.form('POST', `/requests/${id(latestReq.requestId)}/photos`, form, true);
            }
            if (edit === 'close') {
                await api.post(`/requests/${id(latestReq.requestId)}/closure`, {
                    expectedRevision: latestReq.revision,
                    items: latestReq.workItems.map(w => ({ workItemId: w.workItemId, resolved: false, reason: '사용자가 추가 진행을 원하지 않음' })),
                }, true);
            }
            if (edit === 'facts' && latestWorkInitial) {
                let latestWork = latestWorkInitial;
                const regionChanged = latestReq.region?.city !== '서울특별시'
                    || latestReq.region?.district !== district.trim()
                    || latestReq.region?.neighborhood !== neighborhood.trim();
                if (district.trim() && neighborhood.trim() && regionChanged) {
                    const updatedReq = await api.editRequest(latestReq.requestId, latestReq.revision, {
                        region: { city: '서울특별시', district: district.trim(), neighborhood: neighborhood.trim() },
                    }) as Request;
                    latestWork = updatedReq.workItems.find(w => w.workItemId === latestWorkInitial.workItemId) || latestWork;
                }
                const visitPreference = visitDate
                    ? (visitMode === 'FIXED'
                        ? { mode: 'FIXED', fixedStartAt: seoulIso(visitDate, visitStart), ranges: [] }
                        : { mode: 'FLEXIBLE', fixedStartAt: null, ranges: [{ startAt: seoulIso(visitDate, visitStart), endAt: seoulIso(visitDate, visitEnd) }] })
                    : null;
                const body: Record<string, unknown> = {
                    expectedRevision: latestWork.revision,
                    facts: {
                        part: factPart.trim() || null,
                        workType: factWorkType.trim() || null,
                        quantity: Number(factQty) || 1,
                        fields: factFields,
                        visitPreference,
                    },
                };
                if (!latestWork.activeReservationId && latestWork.resolutionPath !== 'TECHNICIAN') {
                    body.resolutionPath = 'TECHNICIAN';
                }
                const wasConfirmed = latestWorkInitial.reviewStatus === 'CONFIRMED';
                const patched = await api.patchWorkItem(latestWork.workItemId, body) as WorkItem;
                if (wasConfirmed && patched?.summary?.text && factFields.length > 0) {
                    await api.confirmWork(patched.workItemId, {
                        expectedRevision: patched.revision,
                        sourceRevision: patched.sourceRevision,
                        fields: factFields,
                        confirmed: true,
                        summary: patched.summary,
                    });
                }
            }
            if (edit === 'confirm' && latestWorkInitial) {
                await api.confirmWork(latestWorkInitial.workItemId, {
                    expectedRevision: latestWorkInitial.revision,
                    sourceRevision: latestWorkInitial.sourceRevision,
                    fields: confirmFields,
                    confirmed: true,
                    summary: {
                        text: confirmText.trim(),
                        facts: latestWorkInitial.summary?.facts || [],
                        unknowns: latestWorkInitial.summary?.unknowns?.length ? latestWorkInitial.summary.unknowns : ['정확한 원인은 현장 점검 필요'],
                        riskSignals: latestWorkInitial.summary?.riskSignals || [],
                        limitations: latestWorkInitial.summary?.limitations || [],
                        onsiteInspectionNeeded: true,
                    },
                });
            }
            setEdit(null);
            await refresh();
        }, '변경 사항을 저장했어요.');
    }

    if (loading)
        return <><PageHeader title="수리 요청 상세"/><Spinner /></>;
    if (error || !request)
        return <><PageHeader title="수리 요청 상세"/><ErrorState message={error || '요청을 찾을 수 없어요.'}/></>;

    const pref = work?.facts?.visitPreference as any;
    const hasVisitPref = !!(pref?.fixedStartAt || pref?.ranges?.length);
    const visitSummary = pref?.mode === 'FIXED'
        ? `지정 시작 · ${datetime(pref.fixedStartAt)}`
        : pref?.ranges?.[0]
            ? `유연 구간 · ${datetime(pref.ranges[0].startAt)} ~ ${seoulTimePart(pref.ranges[0].endAt)}`
            : '미입력';

    const routeBlockers: string[] = [];
    if (work) {
        if (!request.region?.neighborhood)
            routeBlockers.push('작업 지역(서울 구·동)');
        else if (work.support && ['UNSUPPORTED_REGION', 'UNSUPPORTED_FIELD', 'DATA_INCOMPLETE'].includes(work.support.status))
            routeBlockers.push(work.support.reasons?.[0] || '지원 지역·분야 조건');
        if (!work.facts?.fields?.length)
            routeBlockers.push('수리 분야');
        if (!work.facts?.workType)
            routeBlockers.push('작업 종류 (예: 수전 교체)');
        if (!hasVisitPref)
            routeBlockers.push('방문 가능 구간');
        if (work.reviewStatus !== 'CONFIRMED')
            routeBlockers.push('요약·분야 확인 완료');
    }
    const needFactsForRoute = !!work && (!request.region?.neighborhood || !work.facts?.fields?.length || !work.facts?.workType || !hasVisitPref || (work.support && work.support.status !== 'SUPPORTED'));
    const needConfirmForRoute = !!work && work.reviewStatus !== 'CONFIRMED';

    return <><PageHeader title="수리 요청 상세" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/><div className="rx-body">
        <div className="rx-card rx-detail-head">
            <div className="rx-inline">
                <Tag>{statusLabel(request.status)}</Tag>
                {request.region?.neighborhood && <Tag tone="sage">{request.region.district} {request.region.neighborhood}</Tag>}
            </div>
            <h2>{request.symptom}</h2>
            <p>마지막 업데이트 · {day(request.updatedAt)}</p>
            <div className="rx-inline">
                <button className="rx-link" onClick={() => { setValue(request.symptom); setEdit('symptom'); }}><Icon name="edit" size={15}/> 내용 수정</button>
                <button className="rx-link" onClick={() => setEdit('record')}><Icon name="plus" size={15}/> 경과 기록</button>
            </div>
        </div>
        {allPhotos(request).length > 0 && <div className="rx-photo-list">{allPhotos(request).slice(0, 6).map(p => <div key={p.photoId} className="rx-photo-entry"><MediaImage photo={p} className="rx-photo-tile"/><small>{p.capturedOn ? day(p.capturedOn) : '촬영일 미확인'}</small></div>)}</div>}
        <div className="rx-section-title"><div><h2>작업 항목</h2><p>각 고장은 따로 진행할 수 있어요.</p></div><button className="rx-link" onClick={() => setEdit('item')}><Icon name="plus" size={15}/> 추가</button></div>
        <div className="rx-chips">{request.workItems?.map(w => <button key={w.workItemId} className={work?.workItemId === w.workItemId ? 'active' : ''} onClick={() => setSelected(w.workItemId)}>{String(w.facts?.part || w.facts?.workType || '수리 부위')} · {statusLabel(w.status)}</button>)}</div>
        {work && <div className="rx-card">
            <div className="rx-inline">
                <Tag tone="sage">{statusLabel(work.status)}</Tag>
                <Tag tone={work.reviewStatus === 'CONFIRMED' ? 'sage' : 'rose'}>{statusLabel(work.reviewStatus || 'DRAFT')}</Tag>
                {work.routeExplorationEnabled && <Tag tone="lavender">동선 탐색 중</Tag>}
            </div>
            <h3>{work.summary?.text || String(work.facts?.part || '아직 확인된 요약이 없어요.')}</h3>
            <p>분야: {work.facts?.fields?.length ? work.facts.fields.map(fieldLabel).join(' · ') : '미확인'} · 작업: {String(work.facts?.workType || '미입력')} {work.facts?.quantity ? `(${work.facts.quantity}건)` : ''}</p>
            <p>방문 조건: {visitSummary}</p>
            <div className="rx-duo-buttons">
                <Button kind="outline" disabled={busy} onClick={openFactsModal}>작업·방문 조건 설정</Button>
                <Button kind={work.reviewStatus === 'CONFIRMED' ? 'outline' : 'secondary'} disabled={busy} onClick={openConfirmModal}>{work.reviewStatus === 'CONFIRMED' ? '요약·분야 다시 확인' : '요약·분야 직접 확인'}</Button>
            </div>
        </div>}
        {work && !work.activeReservationId && <div className="rx-card">
            <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                <h3>동선 제안 탐색 (기사 추천 받기)</h3>
                <Tag tone={work.routeExplorationEnabled ? 'sage' : 'rose'}>{work.routeExplorationEnabled ? '탐색 활성' : '탐색 꺼짐'}</Tag>
            </div>
            <p>유연한 방문 구간을 등록하고 탐색을 켜면, 인근 출장 일정이 있는 기사에게 개인정보 없이 최소 작업 정보(분야·동·방문 가능 구간·기준 소요시간)만 공개돼요.</p>
            {!work.routeExplorationEnabled && routeBlockers.length > 0 && <div className="rx-case-block">
                <strong>탐색을 켜기 전에 아래 항목을 먼저 설정해 주세요</strong>
                <p className="rx-warn">{routeBlockers.join(' · ')}</p>
                <div className="rx-duo-buttons">
                    {needFactsForRoute && <Button kind="outline" disabled={busy} onClick={openFactsModal}>작업·방문 조건 설정</Button>}
                    {needConfirmForRoute && <Button kind="outline" disabled={busy} onClick={openConfirmModal}>요약·분야 직접 확인</Button>}
                </div>
            </div>}
            {!work.routeExplorationEnabled && <label className="rx-check"><input type="checkbox" disabled={routeBlockers.length > 0} checked={routeConfirm} onChange={e => setRouteConfirm(e.target.checked)}/> 개인 식별 정보 없이 분야·동·방문 가능 구간·추정 시간만 기사 동선 추천에 공개함을 확인했어요.</label>}
            <Button kind={work.routeExplorationEnabled ? 'outline' : 'secondary'} disabled={busy || (!work.routeExplorationEnabled && (!routeConfirm || routeBlockers.length > 0))} onClick={() => void toggleRouteExploration()}>
                {work.routeExplorationEnabled ? '동선 제안 탐색 중단' : '동선 제안 탐색 켜기'}
            </Button>
        </div>}
        <div className="rx-section-title"><div><h2><Icon name="spark" size={18}/> 이제 어떻게 해결할까요?</h2><p>원하는 해결 방법을 선택해 주세요.</p></div></div>
        <div className="rx-detail-actions">{[
            { name: 'AI와 함께 살펴보기', detail: '사진 분석·추가 문답·증상 정리', icon: 'spark', page: 'ai' as const },
            { name: '셀프 수리·제조사 AS', detail: '검증된 방법과 공식 지원 확인', icon: 'shield', page: 'solutions' as const },
            { name: '수리기사 찾아보기', detail: '사례 매칭·일반 후보·동선 참여 기사 비교', icon: 'search', page: 'candidates' as const },
            { name: '받은 견적 비교하기', detail: '비용·할인·방문 시간 확인', icon: 'calendar', page: 'quotes' as const },
        ].map(x => <button key={x.name} className="rx-detail-action" onClick={() => navigate(x.page, x.page === 'candidates' && work ? `${request.requestId}:${work.workItemId}` : request.requestId)}><span className="rx-detail-icon"><Icon name={x.icon} size={24}/></span><span><strong>{x.name}</strong><small>{x.detail}</small></span><Icon name="chevron" size={19}/></button>)}</div>
        <div className="rx-duo-buttons"><Button kind="outline" onClick={() => navigate('records', request.requestId)}>날짜별 경과 기록</Button><Button kind="outline" onClick={() => navigate('report', request.requestId)}>인계 보고서</Button></div>
        <div className="rx-duo-buttons"><Button kind="ghost" onClick={() => setEdit('photos')}>사진 추가</Button><Button kind="ghost" onClick={() => setEdit('close')}>요청 종료</Button></div>
        <PrivacyNote>상담·견적·예약은 사용자가 확인한 뒤 별도로 진행돼요. AI 없이 직접 요약·분야를 확인해도 기사 탐색·예약을 이용할 수 있어요.</PrivacyNote>
    </div>
    {edit && <Modal title={{ symptom: '증상 설명 수정', record: '경과 기록 작성', item: '작업 항목 추가', photos: '사진 추가', close: '요청 종료 확인', facts: '작업·방문 조건 설정', confirm: '요약·분야 직접 확인' }[edit]} onClose={() => setEdit(null)}>
        <div className="rx-form">
            {['symptom', 'record', 'item'].includes(edit) && <Field label="내용"><textarea rows={4} value={value} onChange={e => setValue(e.target.value)} placeholder="내용을 입력해 주세요"/></Field>}
            {edit === 'item' && <><Field label="작업 종류"><input required value={itemWorkType} onChange={e => setItemWorkType(e.target.value)} placeholder="예) 배관 연결부 점검"/></Field><Field label="수리 분야"><select value={itemField} onChange={e => setItemField(e.target.value)}>{fieldCodes.map(x => <option key={x} value={x}>{fieldLabel(x)}</option>)}</select></Field></>}
            {['record', 'photos'].includes(edit) && <Field label="촬영·기록 날짜"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>}
            {edit === 'photos' && <Field label="사진 (JPG·PNG, 5장 이하)"><input type="file" accept="image/jpeg,image/png" multiple onChange={e => setPhotoFiles(Array.from(e.target.files || []))}/></Field>}
            {edit === 'facts' && <>
                <div className="rx-chips">
                    <button type="button" onClick={() => {
                        setDistrict('마포구');
                        setNeighborhood('연남동');
                        setFactPart('거실 미닫이문 하단 레일');
                        setFactWorkType('미닫이문 수리');
                        setFactQty(1);
                        setFactFields(['DOORS_WINDOWS']);
                        setVisitMode('FLEXIBLE');
                        setVisitDate(nextWeekdayDate(6));
                        setVisitStart('14:00');
                        setVisitEnd('17:00');
                    }}>시나리오 1 조건 채우기 (미닫이문 · 토 14~17시)</button>
                    <button type="button" onClick={() => {
                        setDistrict('마포구');
                        setNeighborhood('연남동');
                        setFactPart('싱크대 수전');
                        setFactWorkType('수전 교체');
                        setFactQty(1);
                        setFactFields(['PLUMBING']);
                        setVisitMode('FLEXIBLE');
                        setVisitDate(nextWeekdayDate(4));
                        setVisitStart('14:00');
                        setVisitEnd('17:00');
                    }}>시나리오 2 조건 채우기 (수전 교체 · 목 14~17시)</button>
                </div>
                <div className="rx-duo-buttons">
                    <Field label="서울 구"><input value={district} onChange={e => setDistrict(e.target.value)} placeholder="예) 마포구"/></Field>
                    <Field label="동"><input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="예) 연남동"/></Field>
                </div>
                <Field label="문제 부위"><input value={factPart} onChange={e => setFactPart(e.target.value)} placeholder="예) 거실 미닫이문 하단 레일 / 싱크대 수전"/></Field>
                <Field label="작업 종류 (기준 소요시간표 매칭)" hint="예: 미닫이문 수리, 수전 교체, 벽지 물자국 점검">
                    <input list="fmh-work-types" value={factWorkType} onChange={e => setFactWorkType(e.target.value)} placeholder="작업 종류 선택 또는 입력"/>
                    <datalist id="fmh-work-types">{standardWorkTypes.map(t => <option key={t} value={t}/>)}</datalist>
                </Field>
                <Field label="수량"><input type="number" min={1} value={factQty} onChange={e => setFactQty(Number(e.target.value))}/></Field>
                <div>
                    <p style={{ marginBottom: 6 }}>수리 분야</p>
                    <div className="rx-chips">{fieldCodes.map(code => <label key={code} className="rx-check"><input type="checkbox" checked={factFields.includes(code)} onChange={e => setFactFields(s => e.target.checked ? [...s, code] : s.filter(x => x !== code))}/>{fieldLabel(code)}</label>)}</div>
                </div>
                <Field label="방문 조건 방식">
                    <select value={visitMode} onChange={e => setVisitMode(e.target.value as 'FLEXIBLE' | 'FIXED')}>
                        <option value="FLEXIBLE">유연한 방문 가능 구간</option>
                        <option value="FIXED">특정 시작 희망 시각</option>
                    </select>
                </Field>
                <div className="rx-chips">
                    <button type="button" onClick={() => { setVisitMode('FLEXIBLE'); setVisitDate(nextWeekdayDate(6)); setVisitStart('14:00'); setVisitEnd('17:00'); }}>다가오는 토요일 14~17시</button>
                    <button type="button" onClick={() => { setVisitMode('FLEXIBLE'); setVisitDate(nextWeekdayDate(4)); setVisitStart('14:00'); setVisitEnd('17:00'); }}>다가오는 목요일 14~17시</button>
                </div>
                <Field label="방문 날짜"><input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}/></Field>
                <div className="rx-duo-buttons">
                    <Field label="시작 시각 (15분 단위)"><input type="time" step={900} value={visitStart} onChange={e => setVisitStart(e.target.value)}/></Field>
                    {visitMode === 'FLEXIBLE' && <Field label="종료 시각 (15분 단위)"><input type="time" step={900} value={visitEnd} onChange={e => setVisitEnd(e.target.value)}/></Field>}
                </div>
            </>}
            {edit === 'confirm' && <>
                <div className="rx-chips">
                    <button type="button" onClick={() => {
                        setConfirmText('거실 미닫이문이 닫히기 10cm 전부터 바닥을 긁으며 걸림. 원인은 현장 점검 필요.');
                        setConfirmFields(['DOORS_WINDOWS']);
                    }}>시나리오 1 요약 채우기</button>
                    <button type="button" onClick={() => {
                        setConfirmText('연남동 싱크대 수전 1개 교체 요청. 목요일 14:00~17:00 방문 가능하며 기존 배관 상태는 현장 확인 필요.');
                        setConfirmFields(['PLUMBING']);
                    }}>시나리오 2 요약 채우기</button>
                </div>
                <Field label="증상 요약 (사용자 확인)" hint="AI 없이 직접 확인한 요약으로 기사 추천·상담·예약을 진행할 수 있어요."><textarea rows={4} value={confirmText} onChange={e => setConfirmText(e.target.value)}/></Field>
                <div>
                    <p style={{ marginBottom: 6 }}>확인된 수리 분야</p>
                    <div className="rx-chips">{fieldCodes.map(code => <label key={code} className="rx-check"><input type="checkbox" checked={confirmFields.includes(code)} onChange={e => setConfirmFields(s => e.target.checked ? [...s, code] : s.filter(x => x !== code))}/>{fieldLabel(code)}</label>)}</div>
                </div>
            </>}
            {edit === 'close' && <p>종료 후에는 새 AI 분석·상담이 제한될 수 있어요. 모든 작업 항목을 더 진행하지 않는 것으로 종료할까요?</p>}
            <Button disabled={busy
                || (edit === 'item' && (!value.trim() || !itemWorkType.trim()))
                || (edit === 'photos' && !photoFiles.length)
                || (edit === 'symptom' && !value.trim())
                || (edit === 'record' && !value.trim())
                || (edit === 'facts' && (!factFields.length || !visitDate || (visitMode === 'FLEXIBLE' && visitStart >= visitEnd)))
                || (edit === 'confirm' && (!confirmText.trim() || !confirmFields.length))} onClick={() => void save()}>확인하고 저장하기</Button>
        </div>
    </Modal>}
    </>;
}
