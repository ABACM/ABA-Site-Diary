import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { getSettings, saveSettings as persistSettings } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const DiaryContext = createContext(null);

function freshEntry() {
  return {
    id: uuidv4(),
    date: format(new Date(), 'yyyy-MM-dd'),
    projectName: '',
    projectNo: '',
    weatherAM: '',
    weatherPM: '',
    sections: { work: [''], delays: [''], oral: [''], drawings: [''] },
    subs: [],
    photos: { work: [], delays: [], oral: [], drawings: [], subs: [] },
    checklist: {},
    signatures: {},
    addlNotes: '',
    signoffStatus: 'draft',
    signoffPM: null,
    signoffQA: null,
    savedAt: null,
    pending: false,
  };
}

const initialState = {
  entry: freshEntry(),
  settings: null,
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS': return { ...state, settings: action.payload, loading: false };
    case 'UPDATE_ENTRY': return { ...state, entry: { ...state.entry, ...action.payload } };
    case 'UPDATE_SECTION': return {
      ...state,
      entry: {
        ...state.entry,
        sections: { ...state.entry.sections, [action.key]: action.value },
      },
    };
    case 'UPDATE_SUBS': return { ...state, entry: { ...state.entry, subs: action.payload } };
    case 'UPDATE_CHECKLIST': return {
      ...state,
      entry: {
        ...state.entry,
        checklist: { ...state.entry.checklist, [action.index]: action.value },
      },
    };
    case 'SET_SIGNATURE': return {
      ...state,
      entry: {
        ...state.entry,
        signatures: { ...state.entry.signatures, [action.index]: action.value },
      },
    };
    case 'UPDATE_PHOTOS': return {
      ...state,
      entry: {
        ...state.entry,
        photos: { ...state.entry.photos, [action.sectionId]: action.photos },
      },
    };
    case 'NEW_ENTRY': return { ...state, entry: freshEntry() };
    case 'LOAD_ENTRY': return { ...state, entry: action.payload };
    default: return state;
  }
}

export function DiaryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    getSettings().then(s => dispatch({ type: 'SET_SETTINGS', payload: s }));
  }, []);

  const updateSettings = useCallback(async (updates) => {
    const merged = { ...state.settings, ...updates };
    await persistSettings(merged);
    dispatch({ type: 'SET_SETTINGS', payload: merged });
  }, [state.settings]);

  return (
    <DiaryContext.Provider value={{ state, dispatch, updateSettings }}>
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  return useContext(DiaryContext);
}
