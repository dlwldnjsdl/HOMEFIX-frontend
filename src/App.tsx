import { useApp } from './context/AppContext';
import { AppFrame } from './components/AppFrame';
import { Spinner } from './components/UI';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestsPage from './pages/RequestsPage';
import DetailPage from './pages/DetailPage';
import AIPage from './pages/AIPage';
import SolutionsPage from './pages/SolutionsPage';
import ExpertsPage, { ExpertDetailPage } from './pages/ExpertsPage';
import QuotesPage from './pages/QuotesPage';
import CandidatesPage from './pages/CandidatesPage';
import BookingsPage, { BookingDetailPage } from './pages/BookingsPage';
import RecordsPage from './pages/RecordsPage';
import ReportPage from './pages/ReportPage';
import ConsultationsPage, { ConsultationDetailPage } from './pages/ConsultationsPage';
import ProfilePage, { PrivacyPage } from './pages/ProfilePage';
import TechnicianHome, { TechProfilePage, TechSchedulePage, TechRoutesPage, TechCasesPage } from './pages/TechnicianPages';
export default function App() {
    const { route, initializing } = useApp();
    function page() { switch (route.screen) {
        case 'login':
        case 'signup': return <AuthPage key={route.screen}/>;
        case 'new': return <NewRequestPage />;
        case 'requests': return <RequestsPage />;
        case 'detail': return <DetailPage key={route.id}/>;
        case 'ai': return <AIPage key={route.id}/>;
        case 'solutions': return <SolutionsPage key={route.id}/>;
        case 'experts': return <ExpertsPage />;
        case 'expert': return <ExpertDetailPage key={route.id}/>;
        case 'candidates': return <CandidatesPage key={route.id}/>;
        case 'quotes': return <QuotesPage key={route.id}/>;
        case 'bookings': return <BookingsPage />;
        case 'booking': return <BookingDetailPage key={route.id}/>;
        case 'records': return <RecordsPage key={route.id}/>;
        case 'report': return <ReportPage key={route.id}/>;
        case 'consultations': return <ConsultationsPage />;
        case 'consultation': return <ConsultationDetailPage key={route.id}/>;
        case 'profile': return <ProfilePage />;
        case 'privacy': return <PrivacyPage />;
        case 'tech': return <TechnicianHome />;
        case 'tech-profile': return <TechProfilePage />;
        case 'tech-schedule': return <TechSchedulePage />;
        case 'tech-routes': return <TechRoutesPage />;
        case 'tech-cases': return <TechCasesPage />;
        default: return <HomePage />;
    } }
    return <AppFrame>{initializing ? <Spinner text="계정 상태를 확인하고 있어요"/> : page()}</AppFrame>;
}
