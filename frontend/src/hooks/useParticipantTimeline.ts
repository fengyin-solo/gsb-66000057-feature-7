import { useEffect, useRef, useState } from 'react';
import type { ParticipantStatus } from '../types';

export type ParticipationEventType = 'JOIN' | 'LEAVE' | 'REJOIN';

export interface ParticipationEvent {
  id: string;
  type: ParticipationEventType;
  userId: string;
  userName: string;
  userRole: 'INTERVIEWER' | 'CANDIDATE';
  timestamp: string;
  /** True when the event is reconstructed from the initial snapshot rather than observed live. */
  isHistorical?: boolean;
}

const MAX_EVENTS = 50;
const EVENT_ACTION_ORDER: Record<ParticipationEventType, number> = {
  REJOIN: 0,
  LEAVE: 1,
  JOIN: 2,
};

/**
 * Newest-first, tie-broken deterministically so events arriving in the same
 * batch (多人同时变动) keep a stable order.
 */
const sortEvents = (events: ParticipationEvent[]): ParticipationEvent[] => {
  return [...events].sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    const actionDiff = EVENT_ACTION_ORDER[a.type] - EVENT_ACTION_ORDER[b.type];
    if (actionDiff !== 0) return actionDiff;
    return a.userId.localeCompare(b.userId);
  });
};

/**
 * Derives the interview participation timeline purely from participant
 * snapshots (polling and WebSocket pushes share the same source), so the
 * overview counts and the per-person online status can never drift apart.
 *
 * The first snapshot seeds the timeline with one (historical) join entry per
 * already-present participant; subsequent snapshots diff each participant by
 * userId to observe fresh joins, leaves and reconnects.
 */
export const useParticipantTimeline = (
  roomId: string,
  participants: ParticipantStatus[],
  hydrated: boolean,
  onLiveEvents?: (events: ParticipationEvent[]) => void,
): ParticipationEvent[] => {
  const [events, setEvents] = useState<ParticipationEvent[]>([]);
  const prevParticipantsRef = useRef<Map<string, ParticipantStatus>>(new Map());
  const initializedRef = useRef<boolean>(false);
  const initializedRoomRef = useRef<string>('');
  const onLiveEventsRef = useRef(onLiveEvents);
  onLiveEventsRef.current = onLiveEvents;

  useEffect(() => {
    if (initializedRoomRef.current !== roomId) {
      initializedRef.current = false;
      initializedRoomRef.current = roomId;
      prevParticipantsRef.current = new Map();
      setEvents([]);
    }

    // Wait for the first server snapshot. Otherwise the empty pre-fetch store
    // state would look like an empty room and everyone fetched afterwards
    // would be misreported as a live join (无人加入 vs 尚未加载).
    if (!hydrated) {
      return;
    }

    const prevMap = prevParticipantsRef.current;
    const currentMap = new Map(participants.map((p) => [p.userId, p]));
    const newEvents: ParticipationEvent[] = [];

    if (!initializedRef.current) {
      // Baseline snapshot: reconstruct one join entry per known participant.
      for (const participant of participants) {
        newEvents.push({
          id: `${roomId}-${participant.userId}-seed-join`,
          type: 'JOIN',
          userId: participant.userId,
          userName: participant.userName,
          userRole: participant.userRole,
          timestamp: participant.joinedAt,
          isHistorical: true,
        });
      }
      initializedRef.current = true;
    } else {
      // Fresh join: a participant that was not part of the room before.
      for (const participant of participants) {
        const prev = prevMap.get(participant.userId);
        if (!prev) {
          newEvents.push({
            id: `${roomId}-${participant.userId}-join-${participant.joinedAt}`,
            type: 'JOIN',
            userId: participant.userId,
            userName: participant.userName,
            userRole: participant.userRole,
            timestamp: participant.joinedAt,
          });
          continue;
        }

        if (!prev.isOnline && participant.isOnline) {
          // Reconnect after going offline. Use this participant's own
          // lastHeartbeat so the re-entry time never lines up with another
          // member's activity (最后活跃时间不错位).
          newEvents.push({
            id: `${roomId}-${participant.userId}-rejoin-${participant.lastHeartbeat}`,
            type: 'REJOIN',
            userId: participant.userId,
            userName: participant.userName,
            userRole: participant.userRole,
            timestamp: participant.lastHeartbeat,
          });
        } else if (prev.isOnline && !participant.isOnline) {
          newEvents.push({
            id: `${roomId}-${participant.userId}-leave-${participant.lastHeartbeat}`,
            type: 'LEAVE',
            userId: participant.userId,
            userName: participant.userName,
            userRole: participant.userRole,
            timestamp: participant.lastHeartbeat,
          });
        }
      }

      // A participant record disappearing from the room counts as a leave.
      for (const prev of prevMap.values()) {
        if (!currentMap.has(prev.userId) && prev.isOnline) {
          newEvents.push({
            id: `${roomId}-${prev.userId}-leave-${prev.lastHeartbeat}`,
            type: 'LEAVE',
            userId: prev.userId,
            userName: prev.userName,
            userRole: prev.userRole,
            timestamp: prev.lastHeartbeat,
          });
        }
      }
    }

    prevParticipantsRef.current = currentMap;

    if (newEvents.length > 0) {
      const liveEvents = newEvents.filter((event) => !event.isHistorical);
      if (liveEvents.length > 0 && onLiveEventsRef.current) {
        onLiveEventsRef.current(sortEvents(liveEvents));
      }
      // Dedupe by id: the same event can be observed more than once when
      // polling and WebSocket pushes deliver near-identical snapshots.
      setEvents((prevEvents) => {
        const knownIds = new Set(prevEvents.map((event) => event.id));
        const uniqueEvents = newEvents.filter((event) => !knownIds.has(event.id));
        return uniqueEvents.length === 0
          ? prevEvents
          : sortEvents([...uniqueEvents, ...prevEvents]).slice(0, MAX_EVENTS);
      });
    }
  }, [roomId, participants, hydrated]);

  return events;
};
