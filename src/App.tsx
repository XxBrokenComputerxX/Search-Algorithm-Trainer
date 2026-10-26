import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { StartPage } from './pages/StartPage';
import { AlgorithmPage } from './pages/AlgorithmPage';
import { PlayPage } from './pages/PlayPage';
import { ComparePage } from './pages/ComparePage';
import { EditorHome, EditorPage } from './pages/EditorPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <header className="topbar">
        <NavLink to="/" className="brand" end>
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <path d="M9 15 23 9M9 17l14 6" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <circle cx="8" cy="16" r="5" fill="var(--accent)" />
            <circle cx="24" cy="8" r="5" fill="var(--frontier)" />
            <circle cx="24" cy="24" r="5" fill="var(--path)" />
          </svg>
          Search Trainer
        </NavLink>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Learn
          </NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/editor">Graph editor</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/algo/:algo" element={<AlgorithmPage />} />
          <Route path="/play/:algo/:difficulty/:graphId" element={<PlayPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/editor" element={<EditorHome />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="*" element={<StartPage />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
