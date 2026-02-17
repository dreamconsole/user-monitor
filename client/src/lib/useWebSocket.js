import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/^http/, 'ws');

export default function useWebSocket(onMessage) {
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const reconnectTimer = useRef(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const connect = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                if (reconnectTimer.current) {
                    clearTimeout(reconnectTimer.current);
                    reconnectTimer.current = null;
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (onMessageRef.current) {
                        onMessageRef.current(data);
                    }
                } catch (e) {
                    // ignore parse errors
                }
            };

            ws.onclose = () => {
                setConnected(false);
                // Reconnect after 5 seconds
                reconnectTimer.current = setTimeout(connect, 5000);
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch (e) {
            // WebSocket not available
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
            }
        };
    }, [connect]);

    const send = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    return { connected, send };
}
