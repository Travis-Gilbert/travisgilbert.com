'use client';

import { useEffect } from 'react';

export default function ConsoleEasterEgg() {
  useEffect(() => {
    console.log(
      '%c\n  ████████╗  ██████╗ \n  ╚══██╔══╝ ██╔════╝ \n     ██║    ██║  ███╗\n     ██║    ██║   ██║\n     ██║    ╚██████╔╝\n     ╚═╝     ╚═════╝ \n',
      'color: #B45A2D; font-family: monospace; font-size: 10px;'
    );
    console.log(
      '%cYou found the console. Nice.\n%cInvestigating how design decisions shape human outcomes.\nhttps://travisgilbert.com',
      'color: #B45A2D; font-weight: bold; font-size: 14px;',
      'color: #6A5E52; font-size: 11px;'
    );
  }, []);

  return null;
}
