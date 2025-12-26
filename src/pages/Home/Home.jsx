import React, { useMemo, useState, useEffect } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip } from 'react-tooltip';

import 'react-calendar-heatmap/dist/styles.css';
import 'react-tooltip/dist/react-tooltip.css';
import '../../styles.css';
import chzzkLogoLight from '../../assets/chzzk/logo/chzzklogo_kor(White).png';
import chzzkLogoDark from '../../assets/chzzk/logo/chzzklogo_kor(Black).png';

const endDate = new Date();
endDate.setHours(0, 0, 0, 0);

const startDate = new Date(endDate);
startDate.setDate(endDate.getDate() - 365);

// YYYY-MM-DD (로컬 기준)
const pad2 = (n) => String(n).padStart(2, '0');
const formatDate = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// "YYYY-MM-DD" -> Date(로컬)
const parseDate = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
};

// ✅ 주 시작을 "일요일"로 계산 (weekStart={0}에 맞춤)
const getWeekStartSunday = (dateLike) => {
    const d = new Date(dateLike);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=일 ... 6=토
    d.setDate(d.getDate() - day);
    return d;
};

function usePrefersDark() {
    const [isDark, setIsDark] = useState(
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setIsDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isDark;
}

export default function App() {
    const [hoverWeekStart, setHoverWeekStart] = useState(null);
    const isDark = usePrefersDark();
    const chzzkLogo = isDark ? chzzkLogoLight : chzzkLogoDark;

    // ✅ 1년치 랜덤 데이터(365일 전부)
    const values = useMemo(() => {
        return Array.from({ length: 365 }, (_, i) => {
            const d = new Date(endDate);
            d.setDate(endDate.getDate() - i);
            return {
                date: formatDate(d),
                count: Math.floor(Math.random() * 5), // 0~4
            };
        });
    }, []);

    return (
        <div className='app'>
            <div className="page-header">
                <img
                    src={chzzkLogo}
                    alt="CHZZK"
                    className="chzzk-logo-img"
                />
                <h1>Chzzk Activity Map</h1>
            </div>

            <div className="heatmap-container">
                {/* 카드 헤더 + 아이콘 */}
                <div className="heatmap-header">
                    <div className="heatmap-title">
                        <span className="heatmap-icon" aria-hidden="true">
                            {/* inline icon */}
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M4 19a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a1 1 0 0 1-1 1H4zm1-2h14V8H5v9zM7 10h2v5H7v-5zm4 2h2v3h-2v-3zm4-1h2v4h-2v-4z" />
                            </svg>
                        </span>
                        <div>
                            <div className="heatmap-title-main">Activity</div>
                            <div className="heatmap-title-sub">
                                {formatDate(startDate)} ~ {formatDate(endDate)}
                            </div>
                        </div>
                    </div>

                    {/* 범례 */}
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
                    startDate={startDate}
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
                        if (!value) return null;
                        return {
                            'data-tooltip-id': 'heatmap-tooltip',
                            'data-tooltip-content': `${value.date} : ${value.count}`,
                        };
                    }}
                    transformDayElement={(rect, value) => {
                        // value가 없는 빈칸도 들어올 수 있음
                        const dateStr = value?.date;
                        const dateObj = dateStr ? parseDate(dateStr) : null;

                        // 월 경계(1일) 강조용
                        const isMonthStart = dateObj ? dateObj.getDate() === 1 : false;

                        // hover한 날짜 기준 같은 주 강조
                        let isInHoverWeek = false;
                        if (hoverWeekStart && dateObj) {
                            const ws = getWeekStartSunday(dateObj);
                            isInHoverWeek = ws.getTime() === hoverWeekStart.getTime();
                        }
                        const isWeekDimming = hoverWeekStart && dateObj && !isInHoverWeek;

                        const prevClass = rect.props.className || '';
                        const nextClass = [
                            prevClass,
                            isMonthStart ? 'month-start' : '',
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
                                if (!dateObj) return;
                                setHoverWeekStart(getWeekStartSunday(dateObj));
                            },
                            onMouseLeave: () => setHoverWeekStart(null),
                        });
                    }}
                />
            </div>

            <Tooltip
                id="heatmap-tooltip"
                positionStrategy="fixed"
                style={{ zIndex: 2147483647, pointerEvents: 'none' }}
            />
        </div>
    );
}