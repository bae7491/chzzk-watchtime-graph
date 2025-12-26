import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip } from 'react-tooltip';
import { ClipLoader } from 'react-spinners';

import 'react-calendar-heatmap/dist/styles.css';
import 'react-tooltip/dist/react-tooltip.css';
import '../../styles.css';
import Header from '../../components/Header/Header';

/* -----------------------
 * Date helpers (local)
 * ---------------------- */
const pad2 = (n) => String(n).padStart(2, '0');
const formatDate = (msOrDate) => {
    const d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const parseDate = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
};
const getWeekStartSunday = (dateLike) => {
    const d = new Date(dateLike);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // 0=Sun
    return d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -----------------------
 * Range (end 포함 365일)
 * 오늘(예: 2025-12-27) -> 시작 2024-12-28
 * ---------------------- */
const endDate = new Date();
endDate.setHours(0, 0, 0, 0);

const rangeStartDate = new Date(endDate);
rangeStartDate.setDate(endDate.getDate() - 364); // ✅ 표시 범위 시작

/* -----------------------
 * API fetch (proxy 경유)
 * - page=0부터
 * - 1년 범위만 수집
 * - 중복 제거
 * - 딜레이로 폭주 방지
 * ---------------------- */
export async function fetchVideosLastYear(channelId, { size = 50, signal } = {}) {
    // ✅ UI와 동일한 1년 범위를 사용
    const startMs = rangeStartDate.getTime();
    const endMs = endDate.getTime() + 24 * 60 * 60 * 1000 - 1; // 당일 23:59:59.999

    let page = 0;
    const acc = [];

    while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const url = `/service/v1/channels/${channelId}/videos?page=${page}&size=${size}`;
        const res = await fetch(url, { cache: 'no-store', signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const items = json?.content?.data ?? json?.content?.items ?? json?.data ?? [];
        if (!items.length) break;

        // 범위 내만 누적
        for (const v of items) {
            // ✅ publishDateAt가 없을 수도 있어서 안전하게 처리 (기존 로직 유지)
            const t = Number(v.publishDateAt);
            if (Number.isFinite(t) && t >= startMs && t <= endMs) acc.push(v);
        }

        // 다음 페이지가 더 과거만이면 중단
        const oldestMs = Math.min(...items.map((v) => Number(v.publishDateAt) || Infinity));
        if (oldestMs < startMs) break;

        const hasNext = Boolean(json?.content?.page?.next);
        if (!hasNext && items.length < size) break;

        page += 1;
        await sleep(200); // ✅ 과도한 연속 요청 방지
    }

    // 중복 제거 (videoId 우선)
    const map = new Map();
    for (const v of acc) map.set(v.videoId ?? v.videoNo, v);
    return [...map.values()];
}

/* -----------------------
 * Heatmap values
 * - heatmapStartDate~endDate 전체를 채움(빈 날도 포함)
 * - duration 합산 후 0~24h를 4단계(6h 단위)로 매핑
 * ---------------------- */
export function buildHeatmapValuesDurationLevelFilled(videos, heatmapStartDate, end) {
    const MAX_SEC = 24 * 60 * 60;
    const STEP = 6 * 60 * 60;

    // ✅ publishDate(문자열) 우선으로 날짜 키를 뽑아 타임존 이슈를 회피
    const getDateKey = (v) => {
        if (v?.publishDate) return String(v.publishDate).slice(0, 10); // "YYYY-MM-DD"
        if (v?.publishDateAt) return formatDate(Number(v.publishDateAt)); // fallback
        return null;
    };

    const secondsByDate = new Map();
    for (const v of videos) {
        const date = getDateKey(v);
        if (!date) continue;

        const sec = Number(v.duration) || 0;
        secondsByDate.set(date, (secondsByDate.get(date) ?? 0) + sec);
    }

    const values = [];
    const d = new Date(heatmapStartDate);
    d.setHours(0, 0, 0, 0);

    const endDateLocal = new Date(end);
    endDateLocal.setHours(0, 0, 0, 0);

    while (d <= endDateLocal) {
        const dateStr = formatDate(d);
        const totalSec = secondsByDate.get(dateStr) ?? 0;

        const clamped = Math.min(Math.max(totalSec, 0), MAX_SEC);
        const level = clamped === 0 ? 0 : Math.min(4, Math.ceil(clamped / STEP));

        values.push({ date: dateStr, count: level, totalSec });
        d.setDate(d.getDate() + 1);
    }

    return values;
}

export default function Home() {
    const { search, state } = useLocation();
    const channelId = new URLSearchParams(search).get('channelId');
    const channelName = state?.channelName ?? null;
    const channelImageUrl = state?.channelImageUrl ?? null;
    const [hoverWeekStart, setHoverWeekStart] = useState(null);
    const [videoIdsByDate, setVideoIdsByDate] = useState(() => new Map());

    // heatmapStartDate가 "일요일 시작" 기준이니까 동일하게 일요일 기준으로 주 시작 계산
    const getWeekStart = (dateObj) => getWeekStartSunday(dateObj);

    const [loading, setLoading] = useState(false);
    const reqIdRef = React.useRef(0);
    const abortRef = React.useRef(null);
    const MIN_LOADING_MS = 400;

    // 주 정렬용 startDate(앞쪽 0~6일 생길 수 있음)
    const heatmapStartDate = useMemo(() => getWeekStartSunday(rangeStartDate), []);

    const getDurationRangeLabel = (level) => {
        switch (level) {
            case 1: return '0~6h';
            case 2: return '6~12h';
            case 3: return '12~18h';
            case 4: return '18~24h';
            default: return '0h';
        }
    };

    // 초기 렌더에서도 플래시 없게: 먼저 빈 values로 채워둠
    const [values, setValues] = useState(() =>
        buildHeatmapValuesDurationLevelFilled([], heatmapStartDate, endDate)
    );

    useEffect(() => {
        // ✅ 이전 요청이 있으면 무조건 취소
        abortRef.current?.abort();

        // ✅ channelId가 없으면(로고 클릭) 즉시 초기화하고 끝
        if (!channelId) {
            reqIdRef.current += 1; // 진행중이던 요청 결과 무효화
            setLoading(false);
            setValues(buildHeatmapValuesDurationLevelFilled([], heatmapStartDate, endDate));

            // 추가: 날짜별 videoId 맵 초기화
            setVideoIdsByDate(new Map());

            return;
        }

        const myReqId = ++reqIdRef.current;
        const controller = new AbortController();
        abortRef.current = controller;

        const startedAt = Date.now();

        (async () => {
            setLoading(true);

            // 로딩이 먼저 그려지도록 한 프레임 양보
            await new Promise((r) => requestAnimationFrame(r));

            const videos = await fetchVideosLastYear(channelId, {
                size: 50,
                signal: controller.signal,
            });

            // ✅ 오래된 요청이면 반영 금지
            if (reqIdRef.current !== myReqId) return;

            /* =========================
             * ✅ 추가: 날짜별 videoId Map 생성
             * ========================= */
            const dateMap = new Map();

            for (const v of videos) {
                // publishDate 우선, 없으면 publishDateAt
                const dateKey =
                    v?.publishDate
                        ? String(v.publishDate).slice(0, 10) // "YYYY-MM-DD"
                        : v?.publishDateAt
                            ? formatDate(Number(v.publishDateAt))
                            : null;

                if (!dateKey) continue;

                // videoId 없으면 videoNo fallback
                const vid = v.videoNo != null ? String(v.videoNo) : null;
                if (!vid) continue;

                if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
                dateMap.get(dateKey).push(vid);
            }

            // 중복 제거
            for (const [k, arr] of dateMap) {
                dateMap.set(k, Array.from(new Set(arr)));
            }

            setVideoIdsByDate(dateMap);

            /* =========================
             * 기존 히트맵 데이터 계산
             * ========================= */
            const filled = buildHeatmapValuesDurationLevelFilled(
                videos,
                heatmapStartDate,
                endDate
            );
            setValues(filled);
        })()
            .catch((e) => {
                if (e.name !== 'AbortError') console.error(e);
            })
            .finally(() => {
                if (reqIdRef.current !== myReqId) return;

                const elapsed = Date.now() - startedAt;
                const wait = Math.max(0, MIN_LOADING_MS - elapsed);

                setTimeout(() => {
                    if (reqIdRef.current === myReqId) setLoading(false);
                }, wait);
            });

        return () => controller.abort();
    }, [channelId, heatmapStartDate]);

    return (
        <div className="app">
            <div className="header-block">
                <Header
                    title="Chzzk Activity Map"
                    right={
                        <button
                            className="channel-search-btn"
                            onClick={() => (window.location.href = '/search')}
                        >
                            채널 검색
                        </button>
                    }
                />

                <div className="page-description">
                    본 결과는 치지직 다시보기(VOD)를 기준으로 집계된 데이터입니다.
                </div>
            </div>

            <div className="heatmap-container">
                {loading && (
                    <div className="heatmap-loading-overlay">
                        <ClipLoader size={42} color="#22c55e" />
                        <div className="heatmap-loading-text">데이터 불러오는 중...</div>
                    </div>
                )}

                <div className="heatmap-header">
                    <div className="heatmap-title">
                        <span className="heatmap-icon">
                            {channelImageUrl ? (
                                <img
                                    src={channelImageUrl}
                                    alt={channelName ?? 'streamer'}
                                    className="heatmap-avatar"
                                />
                            ) : (
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M4 19a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a1 1 0 0 1-1 1H4zm1-2h14V8H5v9zM7 10h2v5H7v-5zm4 2h2v3h-2v-3zm4-1h2v4h-2v-4z" />
                                </svg>
                            )}
                        </span>
                        <div>
                            <div className="heatmap-title-main">
                                {channelName ? `${channelName} 님의 1년 Activity` : '1년 Activity'}
                            </div>
                            <div className="heatmap-title-sub">
                                {`기준일: ${formatDate(rangeStartDate)} ~ ${formatDate(endDate)}`}
                            </div>
                        </div>
                    </div>

                    <div className="heatmap-legend" aria-label="legend">
                        <span className="legend-text">Less</span>
                        <span className="legend-box color-empty" />
                        <span className="legend-box color-github-1" />
                        <span className="legend-box color-github-2" />
                        <span className="legend-box color-github-3" />
                        <span className="legend-box color-github-4" />
                        <span className="legend-text">More</span>
                    </div>
                </div>

                <CalendarHeatmap
                    startDate={heatmapStartDate}
                    endDate={endDate}
                    values={values}
                    showWeekdayLabels
                    monthLabels={['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']}
                    weekdayLabels={['', 'Mon', '', 'Wed', '', 'Fri', '']}
                    classForValue={(value) => {
                        if (!value || value.count === 0) return 'color-empty';
                        return `color-github-${value.count}`;
                    }}
                    tooltipDataAttrs={(value) => {
                        const dateStr = value?.date;
                        if (!dateStr) return null;

                        const dateObj = parseDate(dateStr);
                        if (dateObj < rangeStartDate) return null; // ✅ 표시 범위 이전은 숨김

                        const level = value?.count ?? 0;
                        const rangeLabel = getDurationRangeLabel(level);

                        return {
                            'data-tooltip-id': 'heatmap-tooltip',
                            'data-tooltip-content': `${dateStr.replace(/-/g, '.')} : ${rangeLabel}`,
                        };
                    }}
                    transformDayElement={(rect, value) => {
                        const dateStr = value?.date;
                        const dateObj = dateStr ? parseDate(dateStr) : null;

                        const isOutOfRange = dateObj && dateObj < rangeStartDate;

                        // ✅ hover한 날짜 기준 같은 주 강조
                        let isInHoverWeek = false;
                        if (hoverWeekStart && dateObj) {
                            const ws = getWeekStart(dateObj);
                            isInHoverWeek = ws.getTime() === hoverWeekStart.getTime();
                        }
                        const isWeekDimming = hoverWeekStart && dateObj && !isInHoverWeek;

                        const prevClass = rect.props.className || '';
                        const nextClass = [
                            prevClass,
                            isOutOfRange ? 'out-of-range' : '',
                            isInHoverWeek ? 'week-highlight' : '',
                            isWeekDimming ? 'week-dim' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');

                        return React.cloneElement(rect, {
                            className: nextClass,
                            tabIndex: -1,
                            focusable: 'false',
                            onMouseDown: (e) => e.preventDefault(),
                            onMouseEnter: () => {
                                if (!dateObj || isOutOfRange) return;
                                setHoverWeekStart(getWeekStart(dateObj));
                            },
                            onMouseLeave: () => setHoverWeekStart(null),
                            onClick: () => {
                                if (!dateObj || isOutOfRange) return;

                                const ids = videoIdsByDate.get(dateStr) ?? [];
                                if (!ids.length) {
                                    alert(`${dateStr.replace(/-/g, '.')} : 다시보기 없음`);
                                    return;
                                }

                                // ✅ 나중에 상세 페이지 만들면 여기서 navigate로 넘기면 됨
                                // ex) navigate(`/detail?date=${dateStr}`, { state: { videoIds: ids } })

                                alert(
                                    `${dateStr.replace(/-/g, '.')}의 videoId 목록 (${ids.length}개)\n\n` +
                                    ids.join('\n')
                                );
                            },
                        });
                    }}

                />
                {loading && (
                    <div className="heatmap-loading-overlay">
                        <ClipLoader size={42} color="#22c55e" />
                        <div className="heatmap-loading-text">데이터 불러오는 중...</div>
                    </div>
                )}
            </div>

            <Tooltip
                id="heatmap-tooltip"
                positionStrategy="fixed"
                style={{ zIndex: 2147483647, pointerEvents: 'none' }}
            />
        </div>
    );
}