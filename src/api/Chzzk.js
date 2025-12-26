export async function searchChannels(keyword, page = 1, size = 10) {
    if (!keyword.trim()) return [];

    const res = await fetch(
        `/service/v1/search/channels?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`,
        { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    // ✅ [{channel:{...}}, ...] -> [{...}, ...]
    return (json?.content?.data ?? [])
        .map((item) => item.channel)
        .filter(Boolean);
}