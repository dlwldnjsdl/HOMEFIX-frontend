import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, MediaImage, AnnotatedPhoto, Button, Tag, Field, PrivacyNote, Empty, Icon, type RegionBox } from '../components/UI';
import { allPhotos, day, id, firstWork, itemsOf, statusLabel } from '../lib/format';
import type { AiJob, Request, Photo } from '../types/models';
export default function RecordsPage() {
    const { route, navigate, mutate, busy, notice } = useApp();
    const { data: request, loading, error, refresh: refreshRequest } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const { data: timeline, loading: tl, error: te, refresh } = useRemote<any>(() => api.timeline(route.id!), [route.id]);
    const { data: historyJobs, refresh: refreshJobs } = useRemote<any>(() => api.aiHistory(route.id!), [route.id]);
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [label, setLabel] = useState('거실 창문 왼쪽 아래 벽지 물자국');
    const [compareJob, setCompareJob] = useState<AiJob | null>(null);

    const work = firstWork(request);
    const photos = allPhotos(request);
    const photoMap = new Map(photos.map(p => [p.photoId, p]));
    const activeGroup = timeline?.groups?.[0] || null;

    useEffect(() => {
        if (!activeGroup)
            return;
        setLabel(activeGroup.label || '같은 부위');
        const pair: string[] = activeGroup.comparisonPhotoIds || [];
        if (pair.length === 2) {
            setFirst(pair[0]);
            setSecond(pair[1]);
        }
    }, [activeGroup?.groupId, activeGroup?.comparisonPhotoIds?.join(',')]);

    useEffect(() => {
        if (!compareJob || !['QUEUED', 'RUNNING'].includes(compareJob.status))
            return;
        let alive = true;
        const timer = window.setInterval(() => {
            void api.aiStatus(compareJob.jobId).then((j: AiJob) => {
                if (!alive)
                    return;
                setCompareJob(j);
                if (!['QUEUED', 'RUNNING'].includes(j.status)) {
                    void refreshJobs();
                }
            }).catch(() => { });
        }, 1500);
        return () => { alive = false; window.clearInterval(timer); };
    }, [compareJob?.jobId, compareJob?.status, refreshJobs]);

    const latestComparisonJob: AiJob | null = compareJob
        || itemsOf<AiJob>(historyJobs).find(j => j.type === 'PHOTO_COMPARISON' && j.status === 'SUCCEEDED' && !j.stale)
        || itemsOf<AiJob>(historyJobs).find(j => j.type === 'PHOTO_COMPARISON')
        || null;
    const comparison = latestComparisonJob?.result?.comparison || null;

    async function addRecord() {
        if (!description.trim())
            return;
        await mutate(async () => {
            await api.post(`/requests/${id(route.id!)}/records`, {
                record: {
                    occurredOn: date || null,
                    description: description.trim(),
                    photoIds: [],
                    workItemIds: work ? [work.workItemId] : [],
                },
            }, true);
            setDescription('');
            await refresh();
            await refreshRequest();
        }, '경과 기록을 추가했어요.');
    }

    async function savePhotoGroup() {
        if (!first || !second || first === second)
            return notice('서로 다른 사진 두 장을 선택해 주세요.', 'error');
        await mutate(async () => {
            const existingIds: string[] = activeGroup?.photoIds || [];
            const groupPhotoIds = Array.from(new Set([...existingIds, ...photos.map(p => p.photoId), first, second]));
            const updated = await api.put(`/requests/${id(route.id!)}/photo-groups`, {
                sourceRevision: timeline?.sourceRevision,
                groups: [{
                    groupId: activeGroup?.groupId || null,
                    label: label.trim() || '같은 부위',
                    photoIds: groupPhotoIds,
                    selectedPhotoIds: [first, second],
                }],
            }, true);
            setCompareJob(null);
            await refresh();
            await refreshJobs();
            return updated;
        }, '비교할 두 사진을 저장했어요. 이제 AI 사진 비교를 실행할 수 있어요.');
    }

    async function runComparison() {
        if (!request || !activeGroup?.groupId || !timeline?.sourceRevision)
            return notice('먼저 비교할 사진 묶음을 저장해 주세요.', 'error');
        await mutate(async () => {
            const freshTimeline = await api.timeline(request.requestId);
            const group = freshTimeline.groups?.[0];
            if (!group?.groupId || group.comparisonPhotoIds?.length !== 2)
                throw Error('비교할 서로 다른 두 사진이 선택되어 있어야 해요.');
            const job = await api.aiJob(request.requestId, {
                type: 'PHOTO_COMPARISON',
                photoGroupId: group.groupId,
                sourceRevision: freshTimeline.sourceRevision,
            }) as AiJob;
            setCompareJob(job);
        }, 'AI 벽지 물자국 사진 비교를 요청했어요.');
    }

    return <><PageHeader title="날짜별 경과 기록" right={<button className="rx-iconbtn" onClick={() => { void refresh(); void refreshJobs(); }}><Icon name="refresh"/></button>}/>
        <div className="rx-body">
            <div className="rx-overline">PHOTO HISTORY</div>
            <h2 className="rx-page-title">우리 집 수리 경과</h2>
            <p className="rx-lead">같은 부위 사진을 날짜별로 비교하고 변화 관찰 결과를 확인해요.</p>
            {loading || tl ? <Spinner /> : error || te ? <ErrorState message={error || te || ''} onRetry={() => void refresh()}/> : <>
                <section className="rx-card">
                    <h3>등록한 사진 {photos.length}장</h3>
                    <div className="rx-photo-list">
                        {photos.map((p: Photo, index: number) => <div key={p.photoId} className="rx-photo-entry">
                            <MediaImage photo={p} className="rx-photo-tile" alt={p.description || `사진 ${index + 1}`}/>
                            <small><strong>{p.capturedOn ? day(p.capturedOn) : '촬영일 미확인'}</strong></small>
                            {p.description && <small style={{ maxWidth: 96 }}>{p.description}</small>}
                        </div>)}
                    </div>
                    {photos.length === 0 && <p>등록된 사진이 없어요.</p>}
                </section>

                <section className="rx-card rx-form">
                    <h3>같은 부위 사진 비교 (벽지 물자국)</h3>
                    {photos.length >= 3 && (() => {
                        const ordered = [...photos].sort((a, b) => (a.capturedOn || '').localeCompare(b.capturedOn || ''));
                        return <div className="rx-chips">
                            <button type="button" onClick={() => { setFirst(ordered[0].photoId); setSecond(ordered[1].photoId); }}>
                                시나리오 3: 1일차 + 3일차 선택 (비교 유보)
                            </button>
                            <button type="button" onClick={() => { setFirst(ordered[0].photoId); setSecond(ordered[2].photoId); }}>
                                시나리오 3: 1일차 + 4일차 선택 (변화 감지)
                            </button>
                        </div>;
                    })()}
                    <Field label="사진 묶음 이름"><input value={label} onChange={e => setLabel(e.target.value)}/></Field>
                    <div className="rx-duo-buttons">
                        <Field label="기준 사진 (이전)">
                            <select value={first} onChange={e => setFirst(e.target.value)}>
                                <option value="">선택</option>
                                {photos.map((p, i) => <option key={p.photoId} value={p.photoId}>사진 {i + 1} · {p.capturedOn ? day(p.capturedOn) : '날짜 미확인'}</option>)}
                            </select>
                        </Field>
                        <Field label="비교 사진 (이후)">
                            <select value={second} onChange={e => setSecond(e.target.value)}>
                                <option value="">선택</option>
                                {photos.map((p, i) => <option key={p.photoId} value={p.photoId}>사진 {i + 1} · {p.capturedOn ? day(p.capturedOn) : '날짜 미확인'}</option>)}
                            </select>
                        </Field>
                    </div>
                    <div className="rx-duo-buttons">
                        <Button kind="outline" onClick={() => void savePhotoGroup()} disabled={busy}>비교쌍 저장</Button>
                        <Button kind="secondary" onClick={() => void runComparison()} disabled={busy || !activeGroup?.groupId || ['QUEUED', 'RUNNING'].includes(compareJob?.status || '')}>
                            <Icon name="spark" size={16}/> {['QUEUED', 'RUNNING'].includes(compareJob?.status || '') ? 'AI 비교 중…' : 'AI 사진 비교 실행'}
                        </Button>
                    </div>
                    <PrivacyNote>촬영 구도·거리·조명 차이가 크면 비교 불가로 판단을 유보하고 재촬영을 안내해요. 관찰 변화와 내부 원인은 분리 표시해요.</PrivacyNote>
                </section>

                {latestComparisonJob && <section className="rx-card">
                    <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                        <h3>AI 사진 비교 결과</h3>
                        <Tag tone={latestComparisonJob.status === 'SUCCEEDED' ? (comparison?.status === 'CHANGED' ? 'sage' : 'rose') : 'rose'}>
                            {comparison ? statusLabel(comparison.status) : statusLabel(latestComparisonJob.status)}
                        </Tag>
                    </div>
                    {['QUEUED', 'RUNNING'].includes(latestComparisonJob.status) && <Spinner text="두 사진의 구도·조명과 물자국 변화를 비교하고 있어요"/>}
                    {['FAILED', 'TIMED_OUT'].includes(latestComparisonJob.status) && <ErrorState message={latestComparisonJob.error?.message || '사진 비교를 완료하지 못했어요.'}/>}
                    {latestComparisonJob.stale && <p className="rx-warn">비교쌍이나 자료가 변경되어 이전 결과예요. [AI 사진 비교 실행]을 다시 눌러 주세요.</p>}
                    {comparison && <>
                        {comparison.status === 'INCOMPARABLE' && <div className="rx-case-block">
                            <strong>직접 비교가 어려워 판단을 유보했어요</strong>
                            <p>{comparison.reason || '조명·거리·구도 차이로 직접 비교가 어렵습니다.'}</p>
                            {(comparison.retakeGuide?.length ? comparison.retakeGuide : timeline?.retakeGuide || []).map((g: string, i: number) => <p key={i} className="rx-muted">• {g}</p>)}
                        </div>}
                        {comparison.photoIds?.length === 2 && <div className="rx-compare-grid">
                            {comparison.photoIds.map((pid: string, idx: number) => {
                                const p = photoMap.get(pid);
                                const regions: RegionBox[] = (comparison.regions || []).filter((r: RegionBox) => r.photoId === pid);
                                return <AnnotatedPhoto
                                    key={pid}
                                    photo={p}
                                    regions={regions}
                                    alt={`비교 사진 ${idx + 1}`}
                                    caption={`${idx === 0 ? '기준' : '비교'} · ${p?.capturedOn ? day(p.capturedOn) : '날짜 미확인'}`}
                                />;
                            })}
                        </div>}
                        {comparison.observations?.length > 0 && <div className="rx-case-block">
                            <strong>관찰된 변화</strong>
                            {comparison.observations.map((obs: any, i: number) => <p key={i}>• {obs.text}</p>)}
                        </div>}
                        {comparison.causeUnknown && <Tag tone="lavender">내부 원인 미확인 · 현장 점검 필요</Tag>}
                        <Button kind="outline" onClick={() => navigate('report', request!.requestId)}>이 결과로 인계 보고서 정리하기 <Icon name="arrow" size={16}/></Button>
                    </>}
                </section>}

                <section className="rx-card">
                    <h3>날짜별 타임라인</h3>
                    {timeline?.records?.length ? timeline.records.map((r: any) => <div key={r.recordId} className="rx-timeline-item">
                        <span><strong>{r.record?.occurredOn ? day(r.record.occurredOn) : '날짜 미입력'}</strong></span>
                        <p>{r.record?.description || r.record?.text}</p>
                    </div>) : <Empty icon="file" title="기록이 없어요" detail="증상이나 조치 내용을 기록해 보세요."/>}
                </section>

                <div className="rx-card rx-form">
                    <h3>경과 기록 추가</h3>
                    <Field label="기록 날짜"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
                    <Field label="관찰한 변화·시도한 조치"><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="예) 비가 온 날 저녁에 환기했으나 자국이 남아 있음"/></Field>
                    <Button disabled={!description.trim() || busy} onClick={() => void addRecord()}>경과 저장하기</Button>
                </div>
            </>}
        </div></>;
}
