import React from 'react';
import {createRoot} from 'react-dom/client';
import FamLoading from '../../src/components/FamLoading';
import '../../src/index.css';
createRoot(document.getElementById('root')).render(<main style={{minHeight:'100vh',background:'var(--color-surface)'}}><FamLoading label="Loading your family space"/></main>);
