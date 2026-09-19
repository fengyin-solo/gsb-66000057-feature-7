import React from 'react';
import type { ParticipantStatus } from '../types';
import { formatTime, formatTimeAgo } from '../types';
import type { ParticipationEvent, ParticipationEventType } from '../hooks/useParticipantTimeline';

interface ParticipationOverviewProps {
  participants: ParticipantStatus[];
  events: ParticipationEvent[];
}

const EVENT_META: Record<ParticipationEventType, { label: string; verb: string; color: string; bgColor: string; icon: string }> = {
  JOIN: { label: '加入', verb: '加入了房间', color: '#4caf50', bgColor: 'rgba(76, 175, 80, 0.15)', icon: '●' },
  LEAVE: { label: '离开', verb: '离开了房间', color: '#f44336', bgColor: 'rgba(244, 67, 54, 0.15)', icon: '○' },
  REJOIN: { label: '重进', verb: '重新进入', color: '#2196f3', bgColor: 'rgba(33, 150, 243, 0.15)', icon: '↻' },
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color }) => (
  <div style={{
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    backgroundColor: '#2a2a2a',
    borderRadius: '6px',
    border: `1px solid ${color}30`,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 600, color, lineHeight: 1.1 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{sub}</div>}
  </div>
);

export const ParticipationOverview: React.FC<ParticipationOverviewProps> = ({ participants, events }) => {
  // Counts are derived from the exact same participant snapshot the per-person
  // cards render, so the overview can never disagree with the list below.
  const onlineCount = participants.filter((p) => p.isOnline).length;
  const candidates = participants.filter((p) => p.userRole === 'CANDIDATE');
  const interviewers = participants.filter((p) => p.userRole === 'INTERVIEWER');
  const onlineCandidateCount = candidates.filter((p) => p.isOnline).length;
  const onlineInterviewerCount = interviewers.filter((p) => p.isOnline).length;

  return (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{
        margin: '0 0 8px 0',
        fontSize: '14px',
        fontWeight: 500,
        color: '#999',
      }}>
        面试参与概览
      </h4>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <StatCard
          label="在线人数"
          value={String(onlineCount)}
          sub={`共 ${participants.length} 人`}
          color="#4caf50"
        />
        <StatCard
          label="候选人"
          value={String(onlineCandidateCount)}
          sub={`共 ${candidates.length} 人`}
          color="#2196f3"
        />
        <StatCard
          label="面试官"
          value={String(onlineInterviewerCount)}
          sub={`共 ${interviewers.length} 人`}
          color="#9c27b0"
        />
      </div>

      <div style={{
        backgroundColor: '#252525',
        borderRadius: '6px',
        border: '1px solid #333',
        padding: '10px',
      }}>
        <div style={{
          fontSize: '12px',
          color: '#999',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>参与动态</span>
          <span style={{ fontSize: '11px', color: '#666' }}>最近 {events.length} 条</span>
        </div>

        {events.length === 0 ? (
          <div style={{
            padding: '12px 4px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#666',
          }}>
            暂无成员加入
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
          }}>
            {events.map((event) => {
              const meta = EVENT_META[event.type];
              return (
                <div
                  key={event.id}
                  title={`${formatTime(event.timestamp)} · ${formatTimeAgo(event.timestamp)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    backgroundColor: meta.bgColor,
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: meta.color,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 500,
                    backgroundColor: event.userRole === 'INTERVIEWER' ? '#9c27b0' : '#2196f3',
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {event.userRole === 'INTERVIEWER' ? '面试官' : '候选人'}
                  </span>
                  <span style={{
                    color: '#e0e0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {event.userName}
                    <span style={{ color: meta.color, marginLeft: '4px' }}>
                      {meta.verb}
                    </span>
                  </span>
                  <span style={{ color: '#888', fontSize: '11px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
