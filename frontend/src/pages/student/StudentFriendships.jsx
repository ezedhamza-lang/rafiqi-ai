import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function StudentFriendships() {
  const { t } = useI18n();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('friends');
  const [toast, setToast] = useState('');

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/student/friends').catch(() => ({ friends: [], requests: [] })),
    ]).then(([data]) => {
      setFriends(data.friends || []);
      setRequests(data.requests || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendRequest = async (userId) => {
    try {
      await api.post('/student/friends/request', { userId });
      flash(t('studentSpace.friendships.requestSent', 'تم إرسال طلب الصداقة!'));
      setSearch('');
      setSearchResults([]);
    } catch (err) {
      flash(err.response?.data?.error || t('studentSpace.friendships.error', 'خطأ'));
    }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      await api.post(`/student/friends/accept/${friendshipId}`);
      flash(t('studentSpace.friendships.accepted', 'تم قبول طلب الصداقة!'));
      load();
    } catch { /* empty */ }
  };

  const declineRequest = async (friendshipId) => {
    try {
      await api.post(`/student/friends/decline/${friendshipId}`);
      load();
    } catch { /* empty */ }
  };

  const removeFriend = async (friendshipId) => {
    try {
      await api.delete(`/student/friends/${friendshipId}`);
      flash(t('studentSpace.friendships.removed', 'تم حذف الصديق'));
      load();
    } catch { /* empty */ }
  };

  const searchUsers = async (query) => {
    setSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get(`/student/friends/search?q=${encodeURIComponent(query)}`);
      setSearchResults(res.users || []);
    } catch { setSearchResults([]); }
  };

  if (loading) return <div className="fr-loading"><div className="spinner" /></div>;

  return (
    <div className="fr-page">
      <div className="fr-hero">
        <span className="fr-hero__icon">👫</span>
        <h2 className="fr-hero__title">{t('studentSpace.friendships.title', 'أصدقائي')}</h2>
        <p className="fr-hero__sub">{t('studentSpace.friendships.subtitle', 'تواصل مع أصدقائك وتنافس معهم!')}</p>
      </div>

      {toast && <div className="fr-toast">{toast}</div>}

      <div className="fr-tabs">
        <button className={`fr-tab ${tab === 'friends' ? 'fr-tab--active' : ''}`} onClick={() => setTab('friends')}>
          <span className="material-icons">people</span>
          {t('studentSpace.friendships.friendsTab', 'الأصدقاء')} ({friends.length})
        </button>
        <button className={`fr-tab ${tab === 'requests' ? 'fr-tab--active' : ''}`} onClick={() => setTab('requests')}>
          <span className="material-icons">person_add</span>
          {t('studentSpace.friendships.requestsTab', 'الطلبات')} ({requests.length})
        </button>
        <button className={`fr-tab ${tab === 'search' ? 'fr-tab--active' : ''}`} onClick={() => setTab('search')}>
          <span className="material-icons">search</span>
          {t('studentSpace.friendships.searchTab', 'بحث')}
        </button>
      </div>

      {tab === 'friends' && (
        <div className="fr-list">
          {friends.length === 0 ? (
            <div className="fr-empty">
              <span className="fr-empty__icon">👫</span>
              <p>{t('studentSpace.friendships.noFriends', 'ليس لديك أصدقاء بعد. ابحث عن أصدقاء جدد!')}</p>
            </div>
          ) : (
            friends.map(f => (
              <div key={f.id} className="fr-card">
                <div className="fr-card__avatar">{f.name?.[0] || '?'}</div>
                <div className="fr-card__info">
                  <span className="fr-card__name">{f.name}</span>
                  <span className="fr-card__level">{t('studentSpace.friendships.level', 'المستوى')} {f.level || 1} • ⭐ {f.xp || 0}</span>
                </div>
                <div className="fr-card__actions">
                  <button className="fr-btn fr-btn--challenge" onClick={() => flash(t('studentSpace.friendships.challengeSent', 'تم إرسال التحدي!'))}>
                    <span className="material-icons">sports_esports</span>
                  </button>
                  <button className="fr-btn fr-btn--remove" onClick={() => removeFriend(f.friendshipId)}>
                    <span className="material-icons">person_remove</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="fr-list">
          {requests.length === 0 ? (
            <div className="fr-empty">
              <span className="fr-empty__icon">📭</span>
              <p>{t('studentSpace.friendships.noRequests', 'لا توجد طلبات صداقة جديدة')}</p>
            </div>
          ) : (
            requests.map(r => (
              <div key={r.id} className="fr-card fr-card--request">
                <div className="fr-card__avatar">{r.name?.[0] || '?'}</div>
                <div className="fr-card__info">
                  <span className="fr-card__name">{r.name}</span>
                  <span className="fr-card__date">{new Date(r.createdAt).toLocaleDateString('ar-TN')}</span>
                </div>
                <div className="fr-card__actions">
                  <button className="fr-btn fr-btn--accept" onClick={() => acceptRequest(r.id)}>
                    <span className="material-icons">check</span>
                  </button>
                  <button className="fr-btn fr-btn--decline" onClick={() => declineRequest(r.id)}>
                    <span className="material-icons">close</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="fr-search">
          <div className="fr-search__bar">
            <span className="material-icons">search</span>
            <input
              className="fr-search__input"
              placeholder={t('studentSpace.friendships.searchPlaceholder', 'ابحث عن تلميذ بالاسم...')}
              value={search}
              onChange={e => searchUsers(e.target.value)}
            />
          </div>
          <div className="fr-search__results">
            {searchResults.map(u => (
              <div key={u.id} className="fr-card fr-card--search">
                <div className="fr-card__avatar">{u.name?.[0] || '?'}</div>
                <div className="fr-card__info">
                  <span className="fr-card__name">{u.name}</span>
                  <span className="fr-card__level">{t('studentSpace.friendships.level', 'المستوى')} {u.level || 1}</span>
                </div>
                <button className="fr-btn fr-btn--add" onClick={() => sendRequest(u.id)}>
                  <span className="material-icons">person_add</span>
                  {t('studentSpace.friendships.add', 'إضافة')}
                </button>
              </div>
            ))}
            {search.length >= 2 && searchResults.length === 0 && (
              <p className="fr-search__empty">{t('studentSpace.friendships.noResults', 'لم يتم العثور على نتائج')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
