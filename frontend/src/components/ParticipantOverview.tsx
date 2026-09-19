import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantStatus, ParticipantEvent, ParticipantEventType, formatTime, formatTimeAgo } from '../types';

const MAX_EVENTS = 50;

const EVENT_CONFIG: Record<ParticipantEventType, { label: string; icon: string; color: string; bgColor: string }> = {
  JOINED: { label: '加入了面试', icon: '→', color: '#4caf50', bgColor: 'rgba(76, 175, 80, 0.15)' },
  LEFT: { label: '离开了面试', icon: '←', color: '#f44336', bgColor: 'rgba(244, 67, 54, 0.15)' },
  REJOINED: { label: '重新加入面试', icon: '↻', color: '#ff9800', bgColor: 'rgba(255, 152, 0, 0.15)' },
};

interface ParticipantOverviewProps {
  participants: ParticipantStatus[];
  currentUserId?: string;
}

const ParticipantOverview: React.FC<ParticipantOverviewProps> = ({ participants, currentUserId }) => {
  const [events, setEvents] = useState<ParticipantEvent[]>([]);
  const prevParticipantsRef = useRef<Map<string, ParticipantStatus> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const prevMap = prevParticipantsRef.current;
    const nextEvents: ParticipantEvent[] = [];

    const buildEvent = (p: ParticipantStatus, type: ParticipantEventType, time: string): ParticipantEvent => {
      seqRef.current += 1;
      return {
        id: `evt-${seqRef.current}`,
        userId: p.userId,
        userName: p.userName,
        userRole: p.userRole,
        type,
        time,
        seq: seqRef.current,
      };
    };

    if (prevMap === null) {
      // 首次快照：按服务端 joinedAt 还原每位成员的加入记录
      participants.forEach((p) => {
        nextEvents.push(buildEvent(p, 'JOINED', p.joinedAt));
      });
    } else {
      participants.forEach((p) => {
        const prev = prevMap.get(p.userId);
        if (!prev) {
          nextEvents.push(buildEvent(p, 'JOINED', p.joinedAt));
        } else if (prev.isOnline && !p.isOnline) {
          nextEvents.push(buildEvent(p, 'LEFT', p.lastHeartbeat));
        } else if (!prev.isOnline && p.isOnline) {
          nextEvents.push(buildEvent(p, 'REJOINED', p.lastHeartbeat));
        }
      });
      const currentIds = new Set(participants.map((p) => p.userId));
      prevMap.forEach((prev, userId) => {
        if (!currentIds.has(userId)) {
          nextEvents.push(buildEvent(prev, 'LEFT', prev.lastHeartbeat));
        }
      });
    }

    prevParticipantsRef.current = new Map(participants.map((p) => [p.userId, p]));

    if (nextEvents.length > 0) {
      setEvents((prev) => [...nextEvents, ...prev].slice(0, MAX_EVENTS));
    }
  }, [participants]);

  const sortedEvents = useMemo(() => {
    const timeOf = (t: string) => {
      const ms = new Date(t).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    return [...events].sort((a, b) => timeOf(b.time) - timeOf(a.time) || b.seq - a.seq);
  }, [events]);

  const onlineCount = participants.filter((p) => p.isOnline).length;
  const candidateCount = participants.filter((p) => p.userRole === 'CANDIDATE').length;
  const interviewerCount = participants.filter((p) => p.userRole === 'INTERVIEWER').length;

  const summaryChip = (color: string, bgColor: string, label: string, count: number) => (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '6px',
        backgroundColor: bgColor,
        border: `1px solid ${color}40`,
        fontSize: '12px',
        color: '#e0e0e0',
        fontWeight: 500,
        flex: 1,
        justifyContent: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      {label}
      <span style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>{count}</span>
    </div>
  );

  return (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{
        margin: '0 0 12px 0',
        fontSize: '14px',
        fontWeight: 500,
        color: '#999',
      }}>
        参与概览
      </h4>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {summaryChip('#4caf50', 'rgba(76, 175, 80, 0.12)', '在线', onlineCount)}
        {summaryChip('#2196f3', 'rgba(33, 150, 243, 0.12)', '候选人', candidateCount)}
        {summaryChip('#9c27b0', 'rgba(156, 39, 176, 0.12)', '面试官', interviewerCount)}
      </div>

      <div style={{
        backgroundColor: '#262626',
        borderRadius: '6px',
        padding: '10px 12px',
      }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
          成员动态
        </div>
        {sortedEvents.length === 0 ? (
          <div style={{
            fontSize: '12px',
            color: '#666',
            textAlign: 'center',
            padding: '12px 0',
          }}>
            暂无参与动态
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '220px',
            overflowY: 'auto',
          }}>
            {sortedEvents.map((event) => {
              const config = EVENT_CONFIG[event.type];
              const isSelf = currentUserId != null && event.userId === currentUserId;

              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: config.bgColor,
                      color: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                  >
                    {config.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500,
                          backgroundColor: event.userRole === 'INTERVIEWER' ? '#9c27b0' : '#2196f3',
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {event.userRole === 'INTERVIEWER' ? '面试官' : '候选人'}
                      </span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#e0e0e0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {event.userName}
                        {isSelf && <span style={{ color: '#999', marginLeft: '4px' }}>（我）</span>}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: config.color, marginTop: '2px' }}>
                      {config.label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', color: '#bbb', fontFamily: 'monospace' }}>
                      {formatTime(event.time)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#777' }}>
                      {formatTimeAgo(event.time)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantOverview;
