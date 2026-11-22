import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, ScreenIntro, RequestCard, Empty, ErrorState, Spinner, Icon, Button } from '../components/UI';
import { itemsOf } from '../lib/format';
import type { Request } from '../types/models';
export default function RequestsPage() {
    const { session, navigate } = useApp();
    const { data, loading, error, refresh } = useRemote(() => api.requests() as Promise<any>, [session?.loginId]);
    const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
    const rows = itemsOf<Request>(data).filter(r => (`${r.symptom} ${r.workItems?.map(x => x.facts?.part).join(' ')}`).toLocaleLowerCase().includes(search.toLocaleLowerCase())).filter(r => filter === 'all' || (filter === 'closed' ? r.status === 'CLOSED' : r.status !== 'CLOSED'));
    return <><PageHeader title="내 수리 요청" right={<button className="rx-iconbtn" onClick={() => void refresh()}><Icon name="refresh" size={19}/></button>}/><div className="rx-body rx-theme-rose"><ScreenIntro tone="rose" tag="MY HOMECARE" title="우리 집 수리 내역" subtitle="사진과 대화로 시작한 홈케어를 모아봤어요." illustration="category-walls.webp"/><div className="rx-searchbox"><Icon name="search"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="증상이나 수리 분야로 검색" aria-label="내 수리 요청 검색"/><Icon name="filter" size={18}/></div><div className="rx-filters">{[['all', '전체'], ['active', '진행 중'], ['closed', '종료']].map(([id, label]) => <button key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label} {id === 'all' ? itemsOf<Request>(data).length : ''}</button>)}</div>{loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={() => void refresh()}/> : rows.length ? rows.map(r => <RequestCard key={r.requestId} request={r}/>) : <Empty icon="file" title={search ? '검색 결과가 없어요' : '수리 기록이 아직 없어요'} detail={search ? '검색어나 필터를 변경해 보세요.' : '사진으로 우리 집 수리를 시작해 보세요.'} action={<Button onClick={() => navigate('new')}>새 AI 진단 시작</Button>}/>}<div className="rx-bottom-spacer"/><button className="rx-fixed-cta" onClick={() => navigate('new')}><Icon name="plus"/> 새 수리 진단하기 <Icon name="arrow"/></button></div></>;
}
