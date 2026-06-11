import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const SeasonContext = createContext(null);

export const SeasonProvider = ({ children }) => {
  const [currentSeason, setCurrentSeason] = useState(null);
  // Two independent release stages. `parikshanReleased` is the legacy single
  // flag and is treated as a fallback for the Final stage for backward compat.
  const [midReleased, setMidReleased] = useState(false);
  const [finalReleased, setFinalReleased] = useState(false);
  // Which stage is currently OPEN for scorers to enter scores: 'mid' | 'final' | null.
  // Independent of release flags (which control student visibility).
  const [activeStage, setActiveStage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnapshot = null;
    const applyData = (data) => {
      const legacy = !!data.parikshanReleased;
      setCurrentSeason(data.currentSeason ?? null);
      setMidReleased(!!data.midReleased);
      // finalReleased falls back to the legacy flag so already-released seasons
      // keep showing until an admin sets the new flags explicitly.
      setFinalReleased(data.finalReleased != null ? !!data.finalReleased : legacy);
      setActiveStage(data.activeStage === 'mid' || data.activeStage === 'final' ? data.activeStage : null);
      setLoading(false);
    };
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const ref = doc(db, 'globalConfig', 'parikshanSettings');
        unsubSnapshot = onSnapshot(ref, (snap) => {
          applyData(snap.exists() ? snap.data() : {});
        }, (err) => {
          console.error('SeasonContext listener error:', err);
          setCurrentSeason(new Date().getFullYear());
          setMidReleased(false);
          setFinalReleased(false);
          setActiveStage(null);
          setLoading(false);
        });
      } else {
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = null;
        }
        setCurrentSeason(new Date().getFullYear());
        setMidReleased(false);
        setFinalReleased(false);
        setActiveStage(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  return (
    <SeasonContext.Provider value={{ currentSeason, midReleased, finalReleased, activeStage, loading }}>
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used within SeasonProvider');
  // Provide a sensible default if not set yet
  return {
    currentSeason: ctx.currentSeason ?? new Date().getFullYear(),
    midReleased: ctx.midReleased,
    finalReleased: ctx.finalReleased,
    activeStage: ctx.activeStage,
    // Back-compat: anything still reading `parikshanReleased` gets the Final flag.
    parikshanReleased: ctx.finalReleased,
    loading: ctx.loading,
  };
};

export default SeasonContext;
