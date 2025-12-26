import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchChannels } from '../../api/Chzzk';
import { ClipLoader } from 'react-spinners';
import './ChannelSearch.css';
import Header from '../../components/Header/Header';

export default function ChannelSearch() {
    const [keyword, setKeyword] = useState('');
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);

    const onSearch = async () => {
        setLoading(true);
        try {
            const list = await searchChannels(keyword);
            setChannels(list);
        } catch (e) {
            alert('채널 검색 실패');
        } finally {
            setLoading(false);
        }
    };

    const navigate = useNavigate();

    const onSelectChannel = (ch) => {
        navigate(
            `/?channelId=${encodeURIComponent(ch.channelId)}`,
            {
                state: {
                    channelName: ch.channelName,
                    channelImageUrl: ch.channelImageUrl,
                }
            }
        );
    };

    return (
        <div className="app">
            <Header title="채널 검색" />

            <div className="search-bar">
                <div className="search-row">
                    <input
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="채널 이름을 입력하세요"
                        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    />
                    <button onClick={onSearch}>검색</button>
                </div>

                <p className="search-hint">
                    검색 결과는 상위 10명의 스트리머만 표시됩니다.
                </p>
            </div>

            {loading && (
                <div className="search-loading">
                    <ClipLoader size={42} color="#22c55e" />
                    <div className="heatmap-loading-text">검색 중...</div>
                </div>
            )}

            <div className="channel-list">
                {channels.map((ch, idx) => (
                    <div
                        key={ch.channelId ?? `${ch.channelName}-${idx}`}
                        className="channel-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectChannel(ch)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectChannel(ch)}
                    >
                        <div className={`channel-avatar ${!ch.channelImageUrl ? 'placeholder' : ''}`}>
                            {ch.channelImageUrl ? (
                                <img
                                    src={ch.channelImageUrl}
                                    alt={ch.channelName}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement?.classList.add('placeholder');
                                    }}
                                />
                            ) : null}
                        </div>

                        <div className="channel-info">
                            <div className="channel-name" title={ch.channelName}>
                                {ch.channelName}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}