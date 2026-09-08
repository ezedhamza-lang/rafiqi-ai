import { useEffect, useRef, useState } from 'react';
import { api, getToken, getStoredUser } from '../api/client.js';

function spaceForRole(role) {
  if (role === 'STUDENT') return 'student';
  if (role === 'PARENT') return 'parent';
  return 'teacher';
}

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LiveRoom({ session, joinData, canPublish, onExit }) {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [raisedHands, setRaisedHands] = useState([]);
  const [screenShares, setScreenShares] = useState([]);
  const [localReady, setLocalReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [screenError, setScreenError] = useState('');
  const [notice, setNotice] = useState('');

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const roomContainerRef = useRef(null);
  const chatBoxRef = useRef(null);
  const streamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const wsRef = useRef(null);
  const roomRef = useRef(null);
  const meRef = useRef(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const provider = session.provider || 'LOCAL';
  const isHost = !!canPublish;
  const me = getStoredUser();
  meRef.current = me;
  const space = spaceForRole(me?.role);
  const myId = me?.id;

  const myShare = screenShares.find((s) => s.userId === myId);
  const sharingScreen = !!myShare;
  const myHand = raisedHands.find((h) => h.userId === myId);
  const handRaised = !!myHand;

  const wsSend = (payload) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const stopScreenStream = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
  };

  const stopShare = () => {
    if (roomRef.current && provider === 'LIVEKIT') {
      roomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
    }
    stopScreenStream();
    wsSend({ type: 'live:screen-share', room: session.roomName, action: 'stop' });
  };

  const startShare = async () => {
    setScreenError('');
    try {
      if (provider === 'LIVEKIT' && roomRef.current) {
        await roomRef.current.localParticipant.setScreenShareEnabled(true);
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play().catch(() => {});
        }
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stopScreenStream();
          wsSend({ type: 'live:screen-share', room: sessionRef.current.roomName, action: 'stop' });
        });
      }
      wsSend({ type: 'live:screen-share', room: session.roomName, action: 'start' });
      setNotice('بدأت مشاركة الشاشة. تظهر شاشتك للأستاذ والتلاميذ في الغرفة.');
    } catch {
      setScreenError('تعذّرت مشاركة الشاشة. تأكد من منح أذونات الشاشة.');
    }
  };

  const toggleShare = () => {
    if (sharingScreen) stopShare();
    else startShare();
  };

  const toggleHand = () => {
    wsSend({ type: 'live:raise-hand', room: session.roomName, action: handRaised ? 'lower' : 'raise' });
  };

  const sendChat = (e) => {
    e.preventDefault();
    const body = chatInput.trim();
    if (!body) return;
    wsSend({ type: 'live:chat', room: session.roomName, body: body.slice(0, 500) });
    setChatInput('');
  };

  const lowerHand = async (userId) => {
    try {
      await api.post(`/teacher/live/${session.id}/hand/${userId}/lower`);
    } catch (err) {
      setNotice(err.message);
    }
  };

  const stopShareFor = async (userId) => {
    try {
      await api.post(`/teacher/live/${session.id}/screen/${userId}/stop`);
    } catch (err) {
      setNotice(err.message);
    }
  };

  useEffect(() => {
    let disposed = false;
    const cleanup = () => {
      disposed = true;
      stopScreenStream();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'live:presence', room: session.roomName, action: 'leave' }));
        } catch {
          /* ignore */
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {
          /* ignore */
        }
        roomRef.current = null;
      }
    };

    const attachElement = (element, label) => {
      if (!roomContainerRef.current) return;
      const wrap = document.createElement('div');
      wrap.className = 'live-participant';
      const nameEl = document.createElement('div');
      nameEl.className = 'live-participant-name';
      nameEl.textContent = label;
      element.style.width = '100%';
      element.style.height = '100%';
      element.objectFit = 'cover';
      element.autoplay = true;
      element.playsInline = true;
      wrap.appendChild(nameEl);
      wrap.appendChild(element);
      roomContainerRef.current.appendChild(wrap);
    };

    const run = async () => {
      const token = getToken();
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/ws`;
      const ws = token ? new WebSocket(url, [`bearer-${token}`]) : new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'live:presence', room: session.roomName, action: 'join' }));
      };
      ws.onmessage = (evt) => {
        try {
          const d = JSON.parse(evt.data);
          if (d.type === 'live:presence' && d.room === session.roomName) {
            setUsers(d.users || []);
          } else if (d.type === 'live:chat:new' && d.room === session.roomName) {
            setMessages((prev) => [...prev, d.message]);
          } else if (d.type === 'live:raised-hands' && d.room === session.roomName) {
            setRaisedHands(d.hands || []);
          } else if (d.type === 'live:screen-share' && d.room === session.roomName) {
            setScreenShares(d.shares || []);
          } else if (d.type === 'live:chat:error' && d.room === session.roomName) {
            setNotice(d.error);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (!disposed) {
          wsRef.current = null;
        }
      };

      api.get(`/${space}/live/${session.id}/chat`).then(setMessages).catch(() => {});
      api
        .get(`/${space}/live/${session.id}/interactions`)
        .then((d) => {
          setRaisedHands(d.raisedHands || []);
          setScreenShares(d.screenShares || []);
        })
        .catch(() => {});

      if (provider === 'LIVEKIT' && joinData?.serverUrl && joinData?.token) {
        try {
          const { Room, RoomEvent } = await import('livekit-client');
          const room = new Room();
          roomRef.current = room;

          room.on(RoomEvent.LocalTrackPublished, (publication) => {
            if (publication?.track) attachElement(publication.track.attach(), 'أنت (البث)');
          });
          room.on(RoomEvent.TrackSubscribed, (track, participant) => {
            const element = track.attach();
            attachElement(element, participant.name || participant.identity || 'مشارك');
          });
          room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach();
          });

          await room.connect(joinData.serverUrl, joinData.token, { autoSubscribe: true });
          if (isHost) {
            await room.localParticipant.setCameraEnabled(true);
            await room.localParticipant.setMicrophoneEnabled(true);
          }
          setNotice('متصل بالغرفة المباشرة عبر LiveKit.');
        } catch (err) {
          setNotice('تعذّر الاتصال بغرفة LiveKit: ' + (err?.message || 'خطأ غير معروف'));
        }
      } else if (isHost) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (disposed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
          setLocalReady(true);
          setNotice('الكاميرا والميكروفون مفعّلان. هذا بثّ مباشر بصوت وصورة (مزوّد تجريبي).');
        } catch {
          setCamError('تعذّر الوصول إلى الكاميرا/الميكروفون. تأكد من منح الأذونات.');
        }
      } else {
        setNotice('بانتظار بدء البث... سيعرض الأستاذ صورته وصوته هنا مباشرة.');
      }
    };

    run();
    return cleanup;
  }, [provider, joinData, session.roomName, session.id, isHost, space]);

  const statusLabel = { SCHEDULED: 'مجدولة', LIVE: 'حية الآن', ENDED: 'انتهت', CANCELLED: 'ملغاة' }[session.status] || session.status;
  const hostUser = users.find((u) => u.role === 'TEACHER' || u.role === 'ADMIN' || u.role === 'SCHOOL_DIRECTOR' || u.role === 'SUPER_ADMIN');

  return (
    <div className="panel live-room">
      <div className="live-room-head">
        <div>
          <h3>{session.title}</h3>
          <p className="muted">
            {session.subject ? `${session.subject} — ` : ''}
            الحالة: <span className="badge badge-approved">{statusLabel}</span>{' '}
            <span className="badge">{provider === 'LIVEKIT' ? 'LiveKit' : 'مزوّد داخلي'}</span>
          </p>
        </div>
        <button className="btn btn-outline" onClick={onExit}>
          <span className="material-icons">close</span> مغادرة
        </button>
      </div>

      {notice && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{notice}</div>}
      {camError && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{camError}</div>}
      {screenError && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{screenError}</div>}

      <div className="live-room-grid">
        <div className="live-stage">
          {provider === 'LIVEKIT' && joinData?.serverUrl ? (
            <div className="live-tracks" ref={roomContainerRef} />
          ) : (
            <div className="live-tracks" ref={roomContainerRef}>
              {isHost ? (
                localReady ? (
                  <div className="live-participant">
                    <div className="live-participant-name">أنت — بث مباشر (كاميرا + ميكروفون)</div>
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div className="live-empty">
                    <span className="material-icons">videocam</span>
                    <p>{camError ? 'تعذّر تشغيل الكاميرا' : 'جارٍ تفعيل الكاميرا والميكروفون...'}</p>
                  </div>
                )
              ) : (
                <div className="live-empty">
                  <span className="material-icons">live_tv</span>
                  <p>بانتظار بدء الأستاذ للبث... سيعرض الفيديو والصوت هنا لحظة بدئه.</p>
                </div>
              )}
            </div>
          )}

          {sharingScreen && (
            <div className="live-share-tile">
              <div className="live-share-tile-label">
                <span className="material-icons">screen_share</span> شاشتك
              </div>
              <video ref={screenVideoRef} autoPlay playsInline muted />
            </div>
          )}

          {screenShares.filter((s) => s.userId !== myId).map((s) => (
            <div className="live-share-banner" key={s.userId}>
              <span className="material-icons">screen_share</span>
              <span>{s.name} يشارك الشاشة</span>
              {isHost && (
                <button className="btn btn-xs btn-danger" onClick={() => stopShareFor(s.userId)}>
                  إيقاف
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="live-side">
          <div className="panel live-toolbar">
            {!isHost && (
              <button className={`btn btn-sm ${handRaised ? 'btn-warning' : 'btn-outline'}`} onClick={toggleHand}>
                <span className="material-icons">pan_tool_alt</span>
                {handRaised ? 'أنزل يدك' : 'ارفع يدك'}
              </button>
            )}
            <button className={`btn btn-sm ${sharingScreen ? 'btn-danger' : 'btn-outline'}`} onClick={toggleShare}>
              <span className="material-icons">screen_share</span>
              {sharingScreen ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة'}
            </button>
          </div>

          <div className="panel live-chat-panel">
            <h4 className="live-chat-title">
              <span className="material-icons">chat</span> الدردشة الحية
            </h4>
            <div className="live-chat-messages" ref={chatBoxRef}>
              {messages.length === 0 && <p className="muted">لا توجد رسائل بعد... كن أول من يكتب.</p>}
              {messages.map((m) => {
                const mine = m.sender && m.sender.id === myId;
                return (
                  <div key={m.id} className={`chat-msg ${mine ? 'user' : 'assistant'}`}>
                    <div className="chat-bubble">
                      {!mine && <div className="chat-sender">{m.sender?.firstName} {m.sender?.lastName}</div>}
                      <div className="chat-text">{m.body}</div>
                      <div className="chat-time">{fmtTime(m.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form className="live-chat-compose" onSubmit={sendChat}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="اكتب رسالة... (الحد 500 حرف)"
                maxLength={500}
              />
              <button className="btn btn-sm btn-primary" type="submit" aria-label="إرسال">
                <span className="material-icons">send</span>
              </button>
            </form>
          </div>

          <div className="panel" style={{ boxShadow: 'none', padding: '1rem' }}>
            <h4>
              <span className="material-icons">groups</span> في الغرفة ({users.length})
            </h4>
            <ul className="live-members">
              {(hostUser ? [hostUser, ...users.filter((u) => u.id !== hostUser.id)] : users).map((u) => (
                <li key={u.id}>
                  <span className={`live-dot ${u.id === hostUser?.id ? 'live-dot-host' : ''}`} />
                  <span className="live-member-name">{u.name}</span>
                  {u.id === hostUser?.id && <span className="badge badge-accent">البث</span>}
                  {u.id === myId && <span className="badge badge-info">أنت</span>}
                  {raisedHands.some((h) => h.userId === u.id) && (
                    <span className="badge badge-warning live-badge-hand" title="يد مرفوعة">
                      <span className="material-icons">pan_tool_alt</span> يد
                    </span>
                  )}
                  {screenShares.some((s) => s.userId === u.id) && (
                    <span className="badge badge-accent live-badge-share" title="يشارك الشاشة">
                      <span className="material-icons">screen_share</span>
                    </span>
                  )}
                  {isHost && raisedHands.some((h) => h.userId === u.id) && (
                    <button className="btn btn-xs btn-outline live-lower-hand" onClick={() => lowerHand(u.id)}>
                      خفض اليد
                    </button>
                  )}
                </li>
              ))}
              {users.length === 0 && <li className="muted">لا يوجد أحد بعد...</li>}
            </ul>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.8rem' }}>
              {session.maxParticipants ? `السعة القصوى: ${session.maxParticipants} مشارك.` : ''} استعمل الدردشة ورفع اليد
              ومشاركة الشاشة للتفاعل أثناء الحصة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
