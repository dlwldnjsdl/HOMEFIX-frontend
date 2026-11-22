import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, MediaImage, Tag, Button, Field, Modal, PrivacyNote } from '../components/UI';
import { allPhotos, day, firstWork, statusLabel, id, fieldCodes, fieldLabel, assertPhotos } from '../lib/format';
import type { Request, WorkItem } from '../types/models';
export default function DetailPage() {
    const { route, navigate, mutate, busy } = useApp();
    const { data: request, loading, error, refresh } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const [selected, setSelected] = useState('');
    const [edit, setEdit] = useState<'symptom' | 'record' | 'item' | 'photos' | 'close' | null>(null);
    const [value, setValue] = useState(''), [itemWorkType, setItemWorkType] = useState(''), [itemField, setItemField] = useState('PLUMBING'), [date, setDate] = useState(''), [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const work: WorkItem | undefined = request?.workItems?.find(w => w.workItemId === selected) || firstWork(request);
    async function save() { if (!request || !edit)
        return; await mutate(async () => { if (edit === 'symptom')
        await api.editRequest(request.requestId, request.revision, { symptom: value }); if (edit === 'record')
        await api.post(`/requests/${id(request.requestId)}/records`, { record: { occurredOn: date || null, description: value, photoIds: [], workItemIds: work ? [work.workItemId] : [] } }, true); if (edit === 'item')
        await api.post(`/requests/${id(request.requestId)}/work-items`, { expectedRevision: request.revision, facts: { part: value, workType: itemWorkType, quantity: 1, fields: [itemField], otherField: null, product: { productType: null, manufacturer: null, modelName: null }, visitPreference: null } }, true); if (edit === 'photos') {
        assertPhotos(photoFiles);
        const form = new FormData();
        for (const f of photoFiles)
            form.append('files', f);
        form.append('metadata', JSON.stringify(photoFiles.map(() => ({ capturedOn: date || null, dateConfirmed: !!date, description: null, workItemIds: work ? [work.workItemId] : [] }))));
        await api.form('POST', `/requests/${id(request.requestId)}/photos`, form, true);
    } if (edit === 'close')
        await api.post(`/requests/${id(request.requestId)}/closure`, { expectedRevision: request.revision, items: request.workItems.map(w => ({ workItemId: w.workItemId, resolved: false, reason: '사용자가 추가 진행을 원하지 않음' })) }, true); setEdit(null); await refresh(); }, '변경 사항을 저장했어요.'); }
    if (loading)
        return <><PageHeader title="수리 요청 상세"/><Spinner /></>;
    if (error || !request)
        return <><PageHeader title="수리 요청 상세"/><ErrorState message={error || '요청을 찾을 수 없어요.'}/></>;
    return <><PageHeader title="수리 요청 상세" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh"/></button>}/><div className="rx-body"><div className="rx-card rx-detail-head"><Tag>{statusLabel(request.status)}</Tag><h2>{request.symptom}</h2><p>마지막 업데이트 · {day(request.updatedAt)}</p><div className="rx-inline"><button className="rx-link" onClick={() => { setValue(request.symptom); setEdit('symptom'); }}><Icon name="edit" size={15}/> 내용 수정</button><button className="rx-link" onClick={() => setEdit('record')}><Icon name="plus" size={15}/> 경과 기록</button></div></div>
    {allPhotos(request).length > 0 && <div className="rx-photo-list">{allPhotos(request).slice(0, 4).map(p => <MediaImage key={p.photoId} photo={p} className="rx-photo-tile"/>)}</div>}
    <div className="rx-section-title"><div><h2>작업 항목</h2><p>각 고장은 따로 진행할 수 있어요.</p></div><button className="rx-link" onClick={() => setEdit('item')}><Icon name="plus" size={15}/> 추가</button></div><div className="rx-chips">{request.workItems?.map(w => <button key={w.workItemId} className={work?.workItemId === w.workItemId ? 'active' : ''} onClick={() => setSelected(w.workItemId)}>{w.facts?.part || '수리 부위'} · {statusLabel(w.status)}</button>)}</div>
    {work && <div className="rx-card"><div className="rx-inline"><Tag tone="sage">{statusLabel(work.status)}</Tag><Tag>{work.reviewStatus || '확인 전'}</Tag></div><h3>{work.summary?.text || work.facts?.part || '아직 AI 요약이 없어요.'}</h3><p>요약과 분야는 사용자가 최종 확인할 수 있어요.</p></div>}
    <div className="rx-section-title"><div><h2><Icon name="spark" size={18}/> 이제 어떻게 해결할까요?</h2><p>원하는 해결 방법을 선택해 주세요.</p></div></div>
    <div className="rx-detail-actions">{[{ name: 'AI와 함께 살펴보기', detail: '사진 분석·추가 문답·증상 정리', icon: 'spark', page: 'ai' as const }, { name: '셀프 수리·제조사 AS', detail: '검증된 방법과 공식 지원 확인', icon: 'shield', page: 'solutions' as const }, { name: '수리기사 찾아보기', detail: '관련 사례와 일반 후보를 비교', icon: 'search', page: 'candidates' as const }, { name: '받은 견적 비교하기', detail: '비용·할인·방문 시간 확인', icon: 'calendar', page: 'quotes' as const }].map(x => <button key={x.name} className="rx-detail-action" onClick={() => navigate(x.page, x.page === 'candidates' && work ? `${request.requestId}:${work.workItemId}` : request.requestId)}><span className="rx-detail-icon"><Icon name={x.icon} size={24}/></span><span><strong>{x.name}</strong><small>{x.detail}</small></span><Icon name="chevron" size={19}/></button>)}</div>
    <div className="rx-duo-buttons"><Button kind="outline" onClick={() => navigate('records', request.requestId)}>날짜별 경과 기록</Button><Button kind="outline" onClick={() => navigate('report', request.requestId)}>인계 보고서</Button></div><div className="rx-duo-buttons"><Button kind="ghost" onClick={() => setEdit('photos')}>사진 추가</Button><Button kind="ghost" onClick={() => setEdit('close')}>요청 종료</Button></div><PrivacyNote>상담·견적·예약은 사용자가 확인한 뒤 별도로 진행돼요.</PrivacyNote></div>
    {edit && <Modal title={{ symptom: '증상 설명 수정', record: '경과 기록 작성', item: '작업 항목 추가', photos: '사진 추가', close: '요청 종료 확인' }[edit]} onClose={() => setEdit(null)}><div className="rx-form">{['symptom', 'record', 'item'].includes(edit) && <Field label="내용"><textarea rows={4} value={value} onChange={e => setValue(e.target.value)} placeholder="내용을 입력해 주세요"/></Field>}{edit === 'item' && <><Field label="작업 종류"><input required value={itemWorkType} onChange={e => setItemWorkType(e.target.value)} placeholder="예) 배관 연결부 점검"/></Field><Field label="수리 분야"><select value={itemField} onChange={e => setItemField(e.target.value)}>{fieldCodes.map(x => <option key={x} value={x}>{fieldLabel(x)}</option>)}</select></Field></>}{['record', 'photos'].includes(edit) && <Field label="촬영·기록 날짜"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>}{edit === 'photos' && <Field label="사진 (JPG·PNG, 5장 이하)"><input type="file" accept="image/jpeg,image/png" multiple onChange={e => setPhotoFiles(Array.from(e.target.files || []))}/></Field>}{edit === 'close' && <p>종료 후에는 새 AI 분석·상담이 제한될 수 있어요. 모든 작업 항목을 더 진행하지 않는 것으로 종료할까요?</p>}<Button disabled={busy || (edit === 'item' && (!value.trim() || !itemWorkType.trim())) || (edit === 'photos' && !photoFiles.length) || (edit === 'symptom' && !value.trim()) || (edit === 'record' && !value.trim())} onClick={() => void save()}>확인하고 저장하기</Button></div></Modal>}
    </>;
}
