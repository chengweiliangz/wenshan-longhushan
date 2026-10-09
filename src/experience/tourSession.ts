import {useSyncExternalStore} from 'react';
import {subscribeTour,getTourSession} from './tourSessionState';
export * from './tourSessionState';
export const useTourSession=()=>useSyncExternalStore(subscribeTour,getTourSession,getTourSession);
