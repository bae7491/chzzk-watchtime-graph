import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

import chzzkLogoLight from '../../assets/chzzk/logo/chzzklogo_kor(White).png';
import chzzkLogoDark from '../../assets/chzzk/logo/chzzklogo_kor(Black).png';

function usePrefersDark() {
    const [isDark, setIsDark] = useState(
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setIsDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isDark;
}

/**
 * props:
 * - title: string (기본 "Chzzk Activity Map")
 * - right: ReactNode (오른쪽에 버튼/링크 등 넣고 싶을 때)
 */
export default function Header({ title = 'Chzzk Activity Map', right = null }) {
    const navigate = useNavigate();

    const isDark = usePrefersDark();
    const chzzkLogo = isDark ? chzzkLogoLight : chzzkLogoDark;

    const onClickLogo = () => {
        // channelId 쿼리 제거하고 홈으로 이동
        navigate('/', { replace: true });
    };

    return (
        <div className="page-header">
            <div className="page-header-left">
                <img
                    src={chzzkLogo}
                    alt="CHZZK"
                    className="chzzk-logo-img"
                    onClick={onClickLogo}
                    style={{ cursor: 'pointer' }}
                />
                <h1 className="page-title">{title}</h1>
            </div>

            {right ? <div className="page-header-right">{right}</div> : null}
        </div>
    );
}