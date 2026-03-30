'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import { env } from '@/lib/env';

export interface JobProgress {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  current?: number;
  total?: number;
  synced?: number;
  errors?: number;
  message?: string;
  error?: string;
  startedAt: number;
}

/**
 * Hook for receiving real-time admin job progress via WebSocket.
 * Connects to /admin-progress namespace with JWT auth.
 * Only active when user has access token (admin pages are auth-gated).
 */
export function useAdminProgress() {
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [jobs, setJobs] = useState<Map<string, JobProgress>>(new Map());

  useEffect(() => {
    if (!accessToken) return;

    const socketUrl =
      env.NEXT_PUBLIC_WS_URL ||
      env.NEXT_PUBLIC_API_URL ||
      'https://study-abroad-api-1032896108391.us-central1.run.app';

    const socket = io(`${socketUrl}/admin-progress`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('jobStarted', (data: { jobId: string; total?: number }) => {
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(data.jobId, {
          jobId: data.jobId,
          status: 'running',
          current: 0,
          total: data.total,
          startedAt: Date.now(),
        });
        return next;
      });
    });

    socket.on(
      'jobProgress',
      (data: { jobId: string; current: number; total: number; message?: string }) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(data.jobId);
          next.set(data.jobId, {
            ...(existing ?? { jobId: data.jobId, startedAt: Date.now() }),
            status: 'running',
            current: data.current,
            total: data.total,
            message: data.message,
          });
          return next;
        });
      }
    );

    socket.on(
      'jobCompleted',
      (data: { jobId: string; synced?: number; errors?: number; message?: string }) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(data.jobId);
          next.set(data.jobId, {
            ...(existing ?? { jobId: data.jobId, startedAt: Date.now() }),
            status: 'completed',
            synced: data.synced,
            errors: data.errors,
            message: data.message,
          });
          // Auto-clear completed jobs after 10 seconds
          setTimeout(() => {
            setJobs((p) => {
              const n = new Map(p);
              n.delete(data.jobId);
              return n;
            });
          }, 10000);
          return next;
        });
      }
    );

    socket.on('jobFailed', (data: { jobId: string; error: string }) => {
      setJobs((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.jobId);
        next.set(data.jobId, {
          ...(existing ?? { jobId: data.jobId, startedAt: Date.now() }),
          status: 'failed',
          error: data.error,
        });
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const getJob = useCallback((jobId: string) => jobs.get(jobId), [jobs]);

  const isJobRunning = useCallback(
    (jobId: string) => jobs.get(jobId)?.status === 'running',
    [jobs]
  );

  return { jobs, getJob, isJobRunning };
}
