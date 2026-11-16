// useFocusRefresh: load a screen's data when it first appears, and quietly again each time you come back to it.
// Coming back waits until the slide back has finished, so the reload never makes the transition stutter.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

const AFTER_TRANSITION_MS = 450; // the Android slide takes about 400 ms

export function useFocusRefresh(refresh: () => void, { onMount = true } = {}) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const firstFocus = useRef(true);
  useEffect(() => { if (onMount) latest.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    const id = setTimeout(() => latest.current(), AFTER_TRANSITION_MS);
    return () => clearTimeout(id);
  }, []));
}
