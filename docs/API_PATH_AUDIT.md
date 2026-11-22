# API v1.1 경로 코드 참조 현황

- 총 80개 중 **65개** 경로의 코드 참조 패턴 발견, **15개** 참조 미발견.
- 문자열·템플릿 패턴을 찾는 정적 검색 결과입니다. 테스트 통과나 업무 규칙 충족을 뜻하지 않습니다.
- `services/api.ts`와 화면별 동적 URL 표현에 따라 경로 탐지가 과소·과대 판정될 수 있습니다.

| # | Method | API | 경로 코드 참조 |
|---:|---|---|---|
| 1 | `POST` | `/auth/signup` | `src/services/api.ts` |
| 2 | `POST` | `/auth/login` | `src/services/api.ts` |
| 3 | `POST` | `/auth/logout` | `src/services/api.ts` |
| 4 | `GET` | `/auth/me` | `src/services/api.ts` |
| 5 | `PATCH` | `/auth/role` | `src/services/api.ts` |
| 6 | `GET` | `/public/service-info` | `src/services/api.ts` |
| 7 | `GET` | `/public/technicians` | `src/services/api.ts`, `src/pages/ExpertsPage.tsx` |
| 8 | `GET` | `/public/technicians/{technicianId}` | `src/pages/ExpertsPage.tsx`, `src/pages/QuotesPage.tsx` |
| 9 | `GET` | `/public/guidance` | `src/services/api.ts` |
| 10 | `POST` | `/requests` | `src/services/api.ts`, `src/pages/DetailPage.tsx` |
| 11 | `GET` | `/requests` | `src/services/api.ts`, `src/pages/DetailPage.tsx` |
| 12 | `GET` | `/requests/{requestId}` | `src/services/api.ts`, `src/pages/DetailPage.tsx` |
| 13 | `PATCH` | `/requests/{requestId}` | `src/services/api.ts`, `src/pages/DetailPage.tsx` |
| 14 | `PUT` | `/requests/{requestId}/visit-details` | `src/pages/QuotesPage.tsx` |
| 15 | `POST` | `/requests/{requestId}/closure` | `src/pages/DetailPage.tsx` |
| 16 | `POST` | `/requests/{requestId}/work-items` | `src/pages/DetailPage.tsx` |
| 17 | `PATCH` | `/work-items/{workItemId}` | `src/services/api.ts`, `src/pages/SolutionsPage.tsx` |
| 18 | `PUT` | `/work-items/{workItemId}/confirmation` | `src/services/api.ts` |
| 19 | `GET` | `/work-items/{workItemId}/solutions` | `src/services/api.ts` |
| 20 | `POST` | `/work-items/{workItemId}/outcomes` | `src/pages/SolutionsPage.tsx` |
| 21 | `POST` | `/requests/{requestId}/photos` | `src/pages/DetailPage.tsx` |
| 22 | `PUT` | `/photos/{photoId}` | 미발견 |
| 23 | `GET` | `/media/{mediaId}` | `src/components/UI.tsx` |
| 24 | `POST` | `/requests/{requestId}/records` | `src/pages/DetailPage.tsx`, `src/pages/RecordsPage.tsx` |
| 25 | `PATCH` | `/records/{recordId}` | 미발견 |
| 26 | `GET` | `/requests/{requestId}/timeline` | `src/services/api.ts`, `src/pages/RecordsPage.tsx` |
| 27 | `PUT` | `/requests/{requestId}/photo-groups` | `src/pages/RecordsPage.tsx` |
| 28 | `POST` | `/requests/{requestId}/ai-jobs` | `src/services/api.ts` |
| 29 | `GET` | `/requests/{requestId}/ai-jobs` | `src/services/api.ts` |
| 30 | `GET` | `/ai-jobs/{jobId}` | `src/services/api.ts` |
| 31 | `PUT` | `/requests/{requestId}/ai-dialogue` | `src/services/api.ts` |
| 32 | `GET` | `/technicians/me` | `src/services/api.ts`, `src/pages/TechnicianPages.tsx` |
| 33 | `PUT` | `/technicians/me/profile` | `src/pages/TechnicianPages.tsx` |
| 34 | `POST` | `/technicians/me/portfolio-photos` | 미발견 |
| 35 | `GET` | `/technicians/{technicianId}/portfolio` | `src/pages/ExpertsPage.tsx` |
| 36 | `POST` | `/technicians/me/cases` | `src/pages/TechnicianPages.tsx` |
| 37 | `PATCH` | `/technicians/me/cases/{caseId}` | 미발견 |
| 38 | `GET` | `/cases/{caseId}` | 미발견 |
| 39 | `GET` | `/technicians/me/schedule` | `src/pages/TechnicianPages.tsx` |
| 40 | `PUT` | `/technicians/me/schedule` | `src/pages/TechnicianPages.tsx` |
| 41 | `GET` | `/work-items/{workItemId}/case-recommendations` | `src/services/api.ts` |
| 42 | `GET` | `/work-items/{workItemId}/general-candidates` | `src/services/api.ts` |
| 43 | `PUT` | `/work-items/{workItemId}/route-exploration` | 미발견 |
| 44 | `GET` | `/technicians/me/route-candidates` | `src/pages/TechnicianPages.tsx` |
| 45 | `POST` | `/route-candidates/{candidateId}/interests` | 미발견 |
| 46 | `GET` | `/work-items/{workItemId}/interests` | 미발견 |
| 47 | `POST` | `/work-items/{workItemId}/consultations` | `src/pages/CandidatesPage.tsx` |
| 48 | `GET` | `/consultations` | `src/services/api.ts`, `src/pages/CandidatesPage.tsx` |
| 49 | `GET` | `/consultations/{consultationId}` | `src/pages/ConsultationsPage.tsx` |
| 50 | `PATCH` | `/consultations/{consultationId}` | `src/pages/ConsultationsPage.tsx` |
| 51 | `POST` | `/consultations/{consultationId}/quotes` | `src/pages/ConsultationsPage.tsx` |
| 52 | `PATCH` | `/quotes/{quoteId}` | 미발견 |
| 53 | `GET` | `/work-items/{workItemId}/quotes` | `src/services/api.ts` |
| 54 | `POST` | `/reservation-checks` | `src/services/api.ts`, `src/pages/QuotesPage.tsx` |
| 55 | `PUT` | `/reservation-checks/{checkId}/confirmation` | `src/pages/QuotesPage.tsx` |
| 56 | `POST` | `/work-items/{workItemId}/reservations` | `src/pages/QuotesPage.tsx` |
| 57 | `GET` | `/reservations` | `src/services/api.ts`, `src/pages/BookingsPage.tsx` |
| 58 | `GET` | `/reservations/{reservationId}` | `src/pages/BookingsPage.tsx` |
| 59 | `POST` | `/reservations/{reservationId}/cancellation` | `src/pages/BookingsPage.tsx` |
| 60 | `POST` | `/reservations/{reservationId}/changes` | 미발견 |
| 61 | `PATCH` | `/reservation-changes/{changeId}` | `src/pages/BookingsPage.tsx` |
| 62 | `PUT` | `/reservations/{reservationId}/early-start-consent` | `src/pages/BookingsPage.tsx` |
| 63 | `POST` | `/reservations/{reservationId}/work-events` | 미발견 |
| 64 | `PUT` | `/reservations/{reservationId}/end-location` | 미발견 |
| 65 | `PUT` | `/reservations/{reservationId}/preparation-notes` | 미발견 |
| 66 | `POST` | `/work-items/{workItemId}/deliveries` | `src/services/api.ts`, `src/pages/ReportPage.tsx` |
| 67 | `GET` | `/work-items/{workItemId}/deliveries` | `src/services/api.ts`, `src/pages/ReportPage.tsx` |
| 68 | `GET` | `/deliveries/{deliveryId}` | `src/pages/ReportPage.tsx`, `src/pages/CandidatesPage.tsx` |
| 69 | `PUT` | `/deliveries/{deliveryId}/confirmation` | `src/pages/ReportPage.tsx`, `src/pages/CandidatesPage.tsx` |
| 70 | `PUT` | `/work-items/{workItemId}/report` | `src/services/api.ts`, `src/pages/ReportPage.tsx` |
| 71 | `GET` | `/work-items/{workItemId}/report` | `src/services/api.ts`, `src/pages/ReportPage.tsx` |
| 72 | `PUT` | `/work-items/{workItemId}/report/confirmation` | `src/pages/ReportPage.tsx` |
| 73 | `POST` | `/deliveries/{deliveryId}/pdf-jobs` | `src/pages/ReportPage.tsx` |
| 74 | `GET` | `/deliveries/{deliveryId}/pdf-jobs` | `src/pages/ReportPage.tsx` |
| 75 | `GET` | `/pdf-jobs/{jobId}` | `src/pages/ReportPage.tsx` |
| 76 | `GET` | `/pdf-jobs/{jobId}/content` | `src/pages/ReportPage.tsx` |
| 77 | `POST` | `/deletion-jobs` | `src/pages/ProfilePage.tsx` |
| 78 | `GET` | `/deletion-jobs` | `src/pages/ProfilePage.tsx` |
| 79 | `GET` | `/deletion-jobs/{jobId}` | 미발견 |
| 80 | `POST` | `/deletion-jobs/{jobId}/retry` | 미발견 |
