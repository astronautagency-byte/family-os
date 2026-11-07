import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/dark-mode.css';
import CalendarImageImport from '../../src/components/CalendarImageImport';
document.documentElement.dataset.famosTheme = new URLSearchParams(location.search).get('theme') || 'light';
if (document.documentElement.dataset.famosTheme === 'dark') document.documentElement.classList.add('theme-dark');
createRoot(document.getElementById('root')).render(<CalendarImageImport onClose={()=>{}} addEvent={async()=>{throw Error('Preview only: events are not saved.');}}/>);
