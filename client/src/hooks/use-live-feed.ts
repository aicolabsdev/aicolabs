import { useEffect, useState, useRef } from 'react';

export interface LiveEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export function useLiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS] Connected to live feed');
          setIsConnected(true);
          // clear any pending reconnect timer
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const liveEvent: LiveEvent = {
              type: parsed.type,
              data: parsed.data,
              timestamp: new Date(),
            };

            setEvents((prev) => {
              // keep only last 50 events, newest first
              const updated = [liveEvent, ...prev];
              return updated.slice(0, 50);
            });
          } catch (err) {
            console.error('[WS] Failed to parse message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[WS] WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected from live feed');
          setIsConnected(false);
          wsRef.current = null;

          // attempt reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[WS] Failed to create WebSocket:', err);
        // retry after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { events, isConnected };
}
